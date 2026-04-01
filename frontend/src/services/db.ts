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
  photo_url?: string | null;
}

export interface TransactionRecord {
  id: string;
  vendor_id: string;
  product_id?: string;
  transaction_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method?: 'cash' | 'moncash' | 'credit';
  notes?: string;
  recorded_offline: boolean;
  synced_at?: string;
  created_at?: string;
  employee_id?: string | null;
  employee_name?: string | null;
}

export interface MonCashPayment {
  id: string;
  transactionId: string;
  amount: number;
  currency: 'HTG';
  customerPhone: string;
  vendorPhone: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  createdAt: string;
  completedAt: string | null;
  moncashReference: string | null;
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
  created_at?: string;
}

export interface CustomerRecord {
  id: string;
  vendor_id: string;
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
  vendor_id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
}

export interface SupplierRecord {
  id: string;
  vendor_id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SupplierPriceRecord {
  id: string;
  vendor_id: string;
  supplierId: string;
  productId: string;
  price: number;
  unit: string;
  lastUpdated: string;
  notes: string | null;
}

export interface NoteRecord {
  id: string;
  vendor_id: string;
  title: string;
  body: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'white';
  pinned: boolean;
  category: 'supplier' | 'customer' | 'order' | 'reminder' | 'general' | null;
  linked_product_id: string | null;
  linked_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export type Permission = 'sales' | 'inventory' | 'inventory_edit' | 'credit' | 'reports' | 'settings' | 'employees' | 'notes' | 'suppliers';

export const OWNER_PERMISSIONS: Permission[] = ['sales', 'inventory', 'inventory_edit', 'credit', 'reports', 'settings', 'employees', 'notes', 'suppliers'];
export const ASSISTANT_PERMISSIONS: Permission[] = ['sales', 'inventory'];

export interface LocationRecord {
  id: string;
  vendor_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface LocationStockRecord {
  id: string;
  location_id: string;
  product_id: string;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface EmployeeRecord {
  id: string;
  vendor_id: string;
  name: string;
  pin_hash: string;
  role: 'owner' | 'assistant' | 'manager';
  permissions: Permission[];
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export type ExpenseCategory = 'rent' | 'transport' | 'phone' | 'salary' | 'fuel' | 'supplies' | 'other';

export interface ExpenseRecord {
  id: string;
  vendor_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  date: string;
  is_recurring: boolean;
  recurrence: 'daily' | 'weekly' | 'monthly' | null;
  employee_id: string | null;
  location_id: string | null;
  created_at: string;
}

export interface GoalRecord {
  id: string;
  vendor_id: string;
  type: 'daily' | 'weekly' | 'monthly';
  target_amount: number;
  is_active: boolean;
  created_at: string;
}

export interface LoyaltyProgramRecord {
  id: string;
  vendor_id: string;
  name: string;
  required_purchases: number;
  reward_description: string;
  reward_value: number;
  is_active: boolean;
  created_at: string;
}

export interface LoyaltyCardRecord {
  id: string;
  vendor_id: string;
  customer_name: string;
  program_id: string;
  stamps: number;
  rewards_earned: number;
  last_stamp_date: string;
  created_at: string;
}

export type CalendarEventType = 'market_day' | 'delivery' | 'credit_due' | 'expense_due' | 'custom' | 'reminder';

export interface CalendarEvent {
  id: string;
  vendor_id: string;
  title: string;
  date: string;
  time: string | null;
  type: CalendarEventType;
  color: string;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly';
  recurring_days: number[] | null;
  linked_customer_id: string | null;
  linked_supplier_id: string | null;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface PerformanceReportRecord {
  id: string;
  vendor_id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  is_read: boolean;
  summary: { total_revenue: number; total_transactions: number; total_products_sold: number };
  employees: {
    employee_id: string | null;
    name: string;
    role: string;
    is_owner: boolean;
    metrics: {
      revenue: number;
      transaction_count: number;
      products_sold: number;
      average_transaction_value: number;
      largest_sale: number;
      days_worked: number;
      revenue_per_day: number;
      credit_given: number;
      moncash_collected: number;
    };
    top_products: { name: string; emoji: string; quantity: number; revenue: number }[];
    comparison: { revenue_rank: number; revenue_vs_average: number; trend_vs_last_period: number };
  }[];
}

interface TalismanDB extends DBSchema {
  products: { key: string; value: ProductRecord };
  transactions: { key: string; value: TransactionRecord };
  creditEntries: { key: string; value: CreditRecord };
  syncQueue: { key: string; value: SyncQueueItem; indexes: { 'by-created': number } };
  customers: { key: string; value: CustomerRecord; indexes: { 'by-name': string } };
  receipts: { key: string; value: ReceiptRecord; indexes: { 'by-date': string } };
  moncashPayments: { key: string; value: MonCashPayment };
  suppliers: { key: string; value: SupplierRecord };
  supplierPrices: { key: string; value: SupplierPriceRecord; indexes: { 'by-product': string; 'by-supplier': string } };
  notes: { key: string; value: NoteRecord; indexes: { 'by-updated': string } };
  employees: { key: string; value: EmployeeRecord };
  locations: { key: string; value: LocationRecord };
  locationStock: { key: string; value: LocationStockRecord; indexes: { 'by-location': string; 'by-product': string } };
  expenses: { key: string; value: ExpenseRecord; indexes: { 'by-date': string } };
  goals: { key: string; value: GoalRecord };
  loyaltyPrograms: { key: string; value: LoyaltyProgramRecord };
  loyaltyCards: { key: string; value: LoyaltyCardRecord; indexes: { 'by-customer': string } };
  calendarEvents: { key: string; value: CalendarEvent; indexes: { 'by-date': string } };
  performanceReports: { key: string; value: PerformanceReportRecord };
}

// ---------------------------------------------------------------------------
// Database singleton — version 2 adds customers + receipts stores + cost_price
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<TalismanDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<TalismanDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TalismanDB>('talisman', 13, {
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
        if (oldVersion < 3) {
          db.createObjectStore('moncashPayments', { keyPath: 'id' });
        }
        if (oldVersion < 4) {
          db.createObjectStore('suppliers', { keyPath: 'id' });
          const spStore = db.createObjectStore('supplierPrices', { keyPath: 'id' });
          spStore.createIndex('by-product', 'productId');
          spStore.createIndex('by-supplier', 'supplierId');
        }
        if (oldVersion < 6) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('by-updated', 'updated_at');
        }
        if (oldVersion < 7) {
          db.createObjectStore('employees', { keyPath: 'id' });
        }
        if (oldVersion < 8) {
          db.createObjectStore('locations', { keyPath: 'id' });
          const lsStore = db.createObjectStore('locationStock', { keyPath: 'id' });
          lsStore.createIndex('by-location', 'location_id');
          lsStore.createIndex('by-product', 'product_id');
        }
        if (oldVersion < 9) {
          const expStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expStore.createIndex('by-date', 'date');
        }
        if (oldVersion < 10) {
          db.createObjectStore('goals', { keyPath: 'id' });
        }
        if (oldVersion < 11) {
          db.createObjectStore('loyaltyPrograms', { keyPath: 'id' });
          const lcStore = db.createObjectStore('loyaltyCards', { keyPath: 'id' });
          lcStore.createIndex('by-customer', 'customer_name');
        }
        if (oldVersion < 12) {
          const calStore = db.createObjectStore('calendarEvents', { keyPath: 'id' });
          calStore.createIndex('by-date', 'date');
        }
        if (oldVersion < 13) {
          db.createObjectStore('performanceReports', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export async function getAllFromStore<T extends keyof TalismanDB>(
  storeName: T,
): Promise<TalismanDB[T]['value'][]> {
  const db = await getDB();
  return db.getAll(storeName as any);
}

/** Get all records from a store filtered by vendor_id. Use this for all user-facing queries. */
export async function getVendorRecords<T extends 'products' | 'transactions' | 'creditEntries' | 'customers' | 'suppliers' | 'supplierPrices' | 'moncashPayments' | 'receipts' | 'notes' | 'expenses' | 'loyaltyPrograms' | 'loyaltyCards' | 'goals' | 'employees' | 'locations' | 'locationStock' | 'calendarEvents' | 'performanceReports'>(
  storeName: T,
  vendorId: string,
): Promise<TalismanDB[T]['value'][]> {
  const all = await getAllFromStore(storeName);
  return (all as Array<{ vendor_id?: string }>).filter((r) => r.vendor_id === vendorId) as TalismanDB[T]['value'][];
}

export async function putInStore<T extends keyof TalismanDB>(
  storeName: T,
  value: TalismanDB[T]['value'],
): Promise<void> {
  const db = await getDB();
  await db.put(storeName as any, value);
}

export async function deleteFromStore<T extends keyof TalismanDB>(
  storeName: T,
  key: string,
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName as any, key);
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

/** Clear all vendor-specific data from IndexedDB (called on logout).
 *  Note: 'employees' is intentionally excluded — employee records must persist
 *  across login sessions so the employee-selection screen works on next login.
 *  They are vendor-scoped (filtered by vendor_id) so they won't leak across vendors. */
export async function clearAllVendorData(): Promise<void> {
  const db = await getDB();
  const stores = [
    'products', 'transactions', 'creditEntries', 'customers',
    'receipts', 'moncashPayments', 'suppliers', 'supplierPrices', 'syncQueue', 'notes',
    'locations', 'locationStock', 'expenses', 'goals', 'loyaltyPrograms', 'loyaltyCards', 'calendarEvents',
  ] as const;
  for (const store of stores) {
    await db.clear(store);
  }
}

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------

export async function upsertCustomer(name: string, phone: string | undefined, creditAmount: number, isPayment: boolean, vendorId: string = ''): Promise<void> {
  const db = await getDB();
  const all = await db.getAllFromIndex('customers', 'by-name', name);
  // Filter by vendor_id to avoid cross-vendor matches
  const existing = vendorId ? all.find((c) => c.vendor_id === vendorId) : all[0];
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
      vendor_id: vendorId,
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
