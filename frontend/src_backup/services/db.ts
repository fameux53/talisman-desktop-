import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body: unknown;
  createdAt: number;
}

export interface ProductRecord {
  id: string;
  vendor_id: string;
  name: string;
  name_creole?: string;
  unit: string;
  current_price: number;
  cost_price?: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
}

export interface TransactionRecord {
  id: string;
  vendor_id: string;
  product_id?: string;
  transaction_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  notes?: string;
  recorded_offline: boolean;
  synced_at?: string;
  created_at?: string;
}

export interface CreditRecord {
  id: string;
  vendor_id: string;
  customer_name: string;
  customer_phone?: string;
  entry_type: string;
  amount: number;
  balance_after: number;
  description?: string;
  due_date?: string;
  reminder_sent: boolean;
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone?: string;
  totalCredit: number;
  totalPaid: number;
  balance: number;
  lastActivityDate: string;
  createdAt: string;
}

export interface ReceiptRecord {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

interface MarketMamaDB extends DBSchema {
  products: { key: string; value: ProductRecord };
  transactions: { key: string; value: TransactionRecord };
  creditEntries: { key: string; value: CreditRecord };
  syncQueue: { key: string; value: SyncQueueItem; indexes: { 'by-created': number } };
  customers: { key: string; value: CustomerRecord; indexes: { 'by-name': string } };
  receipts: { key: string; value: ReceiptRecord; indexes: { 'by-date': string } };
}

// ---------------------------------------------------------------------------
// Database singleton — version 2 adds customers + receipts stores + cost_price
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<MarketMamaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<MarketMamaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MarketMamaDB>('marketmama', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('products', { keyPath: 'id' });
          db.createObjectStore('transactions', { keyPath: 'id' });
          db.createObjectStore('creditEntries', { keyPath: 'id' });
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('by-created', 'createdAt');
        }
        if (oldVersion < 2) {
          const custStore = db.createObjectStore('customers', { keyPath: 'id' });
          custStore.createIndex('by-name', 'name');
          const rcptStore = db.createObjectStore('receipts', { keyPath: 'id' });
          rcptStore.createIndex('by-date', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export async function getAllFromStore<T extends keyof MarketMamaDB>(
  storeName: T,
): Promise<MarketMamaDB[T]['value'][]> {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function putInStore<T extends keyof MarketMamaDB>(
  storeName: T,
  value: MarketMamaDB[T]['value'],
): Promise<void> {
  const db = await getDB();
  await db.put(storeName, value);
}

export async function deleteFromStore<T extends keyof MarketMamaDB>(
  storeName: T,
  key: string,
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, key);
}

// ---------------------------------------------------------------------------
// Sync queue helpers
// ---------------------------------------------------------------------------

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-created');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------

export async function upsertCustomer(name: string, phone: string | undefined, creditAmount: number, isPayment: boolean): Promise<void> {
  const db = await getDB();
  const all = await db.getAllFromIndex('customers', 'by-name', name);
  const existing = all[0];
  const now = new Date().toISOString();

  if (existing) {
    if (isPayment) {
      existing.totalPaid += creditAmount;
    } else {
      existing.totalCredit += creditAmount;
    }
    existing.balance = existing.totalCredit - existing.totalPaid;
    existing.lastActivityDate = now;
    if (phone && !existing.phone) existing.phone = phone;
    await db.put('customers', existing);
  } else {
    await db.put('customers', {
      id: crypto.randomUUID(),
      name,
      phone,
      totalCredit: isPayment ? 0 : creditAmount,
      totalPaid: isPayment ? creditAmount : 0,
      balance: isPayment ? -creditAmount : creditAmount,
      lastActivityDate: now,
      createdAt: now,
    });
  }
}
