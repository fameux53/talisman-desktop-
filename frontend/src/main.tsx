import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import App from './App.tsx'

// ── Security: purge legacy tokens from localStorage (tokens belong in httpOnly cookies only) ──
// Note: 'at' and 'rt' removed from purge — they collide with tlsm_at (desktop Bearer auth).
for (const key of ['access_token', 'refresh_token', 'token', 'jwt']) {
  for (const prefix of ['tlsm_', 'tl_', 'mm_', '']) {
    localStorage.removeItem(prefix + key);
    sessionStorage.removeItem(prefix + key);
  }
}

// ── Migrate from older app names → Talisman ──

// Migrate localStorage keys: mm_ → tlsm_, tl_ → tlsm_
function migrateLocalStorage() {
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('mm_')) keysToMigrate.push(key);
    else if (key && key.startsWith('tl_') && !key.startsWith('tlsm_')) keysToMigrate.push(key);
  }
  keysToMigrate.forEach((oldKey) => {
    let newKey: string;
    if (oldKey.startsWith('mm_')) newKey = 'tlsm_' + oldKey.slice(3);
    else newKey = 'tlsm_' + oldKey.slice(3); // tl_ → tlsm_
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  });
  // Also migrate locale keys from older names
  for (const oldLocaleKey of ['marketmama_locale', 'taliman_locale']) {
    const oldLocale = localStorage.getItem(oldLocaleKey);
    if (oldLocale) {
      localStorage.setItem('talisman_locale', oldLocale);
      localStorage.removeItem(oldLocaleKey);
    }
  }
  if (keysToMigrate.length > 0) {
    console.log(`[Talisman] Migrated ${keysToMigrate.length} localStorage keys.`);
  }
}

// Migrate IndexedDB: copy data from old DB names to 'talisman', then delete old DBs
async function migrateIndexedDB() {
  if (!indexedDB.databases) return; // Safari < 16 doesn't support this
  const databases = await indexedDB.databases();
  // Check for both old database names
  const oldDbName = databases.find((db) => db.name === 'taliman')?.name
    ?? databases.find((db) => db.name === 'marketmama')?.name;
  if (!oldDbName) return;

  console.log(`[Talisman] Migrating IndexedDB from ${oldDbName} to talisman...`);
  const oldConn = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(oldDbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const storeNames = Array.from(oldConn.objectStoreNames);
  if (storeNames.length === 0) { oldConn.close(); return; }

  // Import getDB which opens the new 'talisman' database with correct schema
  const { getDB } = await import('./services/db');
  const newConn = await getDB();

  for (const storeName of storeNames) {
    try {
      const tx = oldConn.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const allRecords = await new Promise<unknown[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (allRecords.length === 0) continue;
      const newTx = (newConn as unknown as IDBDatabase).transaction(storeName, 'readwrite');
      const newStore = newTx.objectStore(storeName);
      for (const record of allRecords) {
        newStore.put(record);
      }
      await new Promise<void>((resolve, reject) => {
        newTx.oncomplete = () => resolve();
        newTx.onerror = () => reject(newTx.error);
      });
    } catch {
      // Store may not exist in new schema — skip
    }
  }

  oldConn.close();
  // Delete old database
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(oldDbName);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // best effort
    req.onblocked = () => resolve();
  });
  console.log('[Talisman] IndexedDB migration complete.');
}

// Run migrations before rendering
migrateLocalStorage();
migrateIndexedDB().catch((err) => console.warn('[Talisman] IndexedDB migration error:', err));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// ── Service Worker Registration ──
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onRegisteredSW(swUrl, r) {
        console.log('[SW] Registered:', swUrl)
        // Check for updates every hour
        if (r) {
          setInterval(() => { r.update() }, 60 * 60 * 1000)
        }
      },
      onRegisterError(error) {
        console.error('[SW] Registration error:', error)
      },
    })
    // Store the update function globally so the app can trigger it
    ;(window as unknown as Record<string, unknown>).__updateSW = updateSW
  })
}
