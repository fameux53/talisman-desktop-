/**
 * IndexedDB field-level encryption using Web Crypto API (AES-GCM 256-bit).
 *
 * The encryption key is stored in IndexedDB itself (in a separate 'keystore' DB)
 * as a non-extractable CryptoKey. This protects against casual snooping and
 * basic XSS data exfiltration — the key never leaves the browser's crypto module.
 */

const KEY_DB_NAME = 'tlsm_keystore';
const KEY_STORE = 'keys';
const KEY_ID = 'main';

async function getOrCreateKey(): Promise<CryptoKey> {
  // Open a separate DB just for the key
  const keyDB = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(KEY_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Try to load existing key
  const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = keyDB.transaction(KEY_STORE, 'readonly');
    const req = tx.objectStore(KEY_STORE).get(KEY_ID);
    req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
    req.onerror = () => reject(req.error);
  });

  if (existing) {
    keyDB.close();
    return existing;
  }

  // Generate new key (non-extractable)
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );

  // Store it
  await new Promise<void>((resolve, reject) => {
    const tx = keyDB.transaction(KEY_STORE, 'readwrite');
    const req = tx.objectStore(KEY_STORE).put(key, KEY_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  keyDB.close();
  return key;
}

let _cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (!_cachedKey) _cachedKey = await getOrCreateKey();
  return _cachedKey;
}

/**
 * Encrypt a string value. Returns a base64 string containing IV + ciphertext.
 */
export async function encryptField(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  // Concatenate IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64 string (IV + ciphertext) back to plaintext.
 */
export async function decryptField(encrypted: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Encrypt sensitive fields in a record. Non-string fields and null/undefined are skipped.
 * Returns a new object with the specified fields encrypted.
 */
export async function encryptSensitiveFields<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[],
): Promise<T> {
  const result = { ...record };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === 'string' && val.length > 0) {
      (result as Record<string, unknown>)[field as string] = await encryptField(val);
    }
  }
  return result;
}

/**
 * Decrypt sensitive fields in a record.
 */
export async function decryptSensitiveFields<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[],
): Promise<T> {
  const result = { ...record };
  for (const field of fields) {
    const val = result[field];
    if (typeof val === 'string' && val.length > 0) {
      try {
        (result as Record<string, unknown>)[field as string] = await decryptField(val);
      } catch {
        // Field was not encrypted (legacy data) — leave as-is
      }
    }
  }
  return result;
}
