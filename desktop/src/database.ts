import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

let db: Database.Database;

export function initDatabase(): void {
  const userDataPath = app.getPath('userData');
  const dbDir = join(userDataPath, 'data');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  // Migrate from old database names if they exist
  const newDbPath = join(dbDir, 'talisman.db');
  for (const oldName of ['taliman.db', 'marketmama.db']) {
    const oldDbPath = join(dbDir, oldName);
    if (existsSync(oldDbPath) && !existsSync(newDbPath)) {
      console.log(`[Talisman] Renaming database file from ${oldName} to talisman.db...`);
      const { renameSync } = require('fs');
      renameSync(oldDbPath, newDbPath);
      if (existsSync(oldDbPath + '-wal')) renameSync(oldDbPath + '-wal', newDbPath + '-wal');
      if (existsSync(oldDbPath + '-shm')) renameSync(oldDbPath + '-shm', newDbPath + '-shm');
      break;
    }
  }

  const dbPath = newDbPath;
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      preferred_language TEXT DEFAULT 'ht',
      market_zone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_creole TEXT,
      emoji TEXT,
      category TEXT,
      unit TEXT NOT NULL,
      current_price REAL NOT NULL,
      cost_price REAL,
      stock_quantity REAL DEFAULT 0,
      low_stock_threshold REAL DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      product_id TEXT,
      transaction_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      moncash_reference TEXT,
      notes TEXT,
      receipt_number TEXT,
      recorded_offline INTEGER DEFAULT 0,
      synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      vendor_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      total_credit REAL DEFAULT 0,
      total_paid REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      trust_score INTEGER DEFAULT 3,
      last_activity_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS credit_entries (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      entry_type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      description TEXT,
      due_date TEXT,
      reminder_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      location TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    CREATE TABLE IF NOT EXISTS supplier_prices (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      price REAL NOT NULL,
      unit TEXT NOT NULL,
      last_updated TEXT DEFAULT (datetime('now')),
      notes TEXT,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'assistant',
      permissions TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (vendor_id) REFERENCES vendors(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
  `);

  // Migration: add employee tracking columns to transactions
  const hasEmployeeId = db.prepare("SELECT COUNT(*) as cnt FROM pragma_table_info('transactions') WHERE name='employee_id'").get() as { cnt: number };
  if (hasEmployeeId.cnt === 0) {
    db.exec(`
      ALTER TABLE transactions ADD COLUMN employee_id TEXT;
      ALTER TABLE transactions ADD COLUMN employee_name TEXT;
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON transactions(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
    CREATE INDEX IF NOT EXISTS idx_credit_customer ON credit_entries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customers_vendor ON customers(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(created_at);
    CREATE INDEX IF NOT EXISTS idx_employees_vendor ON employees(vendor_id);
  `);
}

export function getDatabase(): Database.Database {
  return db;
}

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'data', 'talisman.db');
}

