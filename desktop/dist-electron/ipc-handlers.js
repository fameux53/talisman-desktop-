"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const database_1 = require("./database");
const exporter_1 = require("./exporter");
const printer_1 = require("./printer");
function registerIpcHandlers() {
    const db = (0, database_1.getDatabase)();
    // --- Database operations ---
    electron_1.ipcMain.handle('db:get-products', () => {
        return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
    });
    electron_1.ipcMain.handle('db:save-product', (_event, product) => {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO products (id, vendor_id, name, name_creole, emoji, category, unit, current_price, cost_price, stock_quantity, low_stock_threshold, is_active, updated_at)
      VALUES (@id, @vendor_id, @name, @name_creole, @emoji, @category, @unit, @current_price, @cost_price, @stock_quantity, @low_stock_threshold, @is_active, datetime('now'))
    `);
        return stmt.run(product);
    });
    electron_1.ipcMain.handle('db:delete-product', (_event, id) => {
        return db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
    });
    electron_1.ipcMain.handle('db:get-transactions', (_event, filters) => {
        let query = 'SELECT * FROM transactions WHERE 1=1';
        const params = {};
        if (filters?.type) {
            query += ' AND transaction_type = @type';
            params.type = filters.type;
        }
        if (filters?.dateFrom) {
            query += ' AND created_at >= @dateFrom';
            params.dateFrom = filters.dateFrom;
        }
        if (filters?.dateTo) {
            query += ' AND created_at <= @dateTo';
            params.dateTo = filters.dateTo;
        }
        if (filters?.paymentMethod) {
            query += ' AND payment_method = @paymentMethod';
            params.paymentMethod = filters.paymentMethod;
        }
        query += ' ORDER BY created_at DESC';
        if (filters?.limit) {
            query += ' LIMIT @limit';
            params.limit = filters.limit;
        }
        return db.prepare(query).all(params);
    });
    electron_1.ipcMain.handle('db:save-transaction', (_event, tx) => {
        const stmt = db.prepare(`
      INSERT INTO transactions (id, vendor_id, product_id, transaction_type, quantity, unit_price, total_amount, payment_method, moncash_reference, notes, receipt_number, created_at)
      VALUES (@id, @vendor_id, @product_id, @transaction_type, @quantity, @unit_price, @total_amount, @payment_method, @moncash_reference, @notes, @receipt_number, datetime('now'))
    `);
        return stmt.run(tx);
    });
    electron_1.ipcMain.handle('db:get-customers', () => {
        return db.prepare('SELECT * FROM customers ORDER BY last_activity_date DESC').all();
    });
    electron_1.ipcMain.handle('db:save-customer', (_event, customer) => {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO customers (id, vendor_id, name, phone, total_credit, total_paid, balance, trust_score, last_activity_date)
      VALUES (@id, @vendor_id, @name, @phone, @total_credit, @total_paid, @balance, @trust_score, @last_activity_date)
    `);
        return stmt.run(customer);
    });
    electron_1.ipcMain.handle('db:get-credit-entries', (_event, customerId) => {
        if (customerId) {
            return db
                .prepare('SELECT * FROM credit_entries WHERE customer_id = ? ORDER BY created_at DESC')
                .all(customerId);
        }
        return db.prepare('SELECT * FROM credit_entries ORDER BY created_at DESC').all();
    });
    electron_1.ipcMain.handle('db:save-credit-entry', (_event, entry) => {
        const stmt = db.prepare(`
      INSERT INTO credit_entries (id, vendor_id, customer_id, customer_name, customer_phone, entry_type, amount, balance_after, description, due_date, created_at)
      VALUES (@id, @vendor_id, @customer_id, @customer_name, @customer_phone, @entry_type, @amount, @balance_after, @description, @due_date, datetime('now'))
    `);
        return stmt.run(entry);
    });
    electron_1.ipcMain.handle('db:get-suppliers', () => {
        return db.prepare('SELECT * FROM suppliers ORDER BY name').all();
    });
    electron_1.ipcMain.handle('db:save-supplier', (_event, supplier) => {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO suppliers (id, vendor_id, name, phone, location, notes)
      VALUES (@id, @vendor_id, @name, @phone, @location, @notes)
    `);
        return stmt.run(supplier);
    });
    electron_1.ipcMain.handle('db:get-receipts', () => {
        return db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all();
    });
    electron_1.ipcMain.handle('db:save-receipt', (_event, receipt) => {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (id, product_name, quantity, unit_price, total, created_at)
      VALUES (@id, @product_name, @quantity, @unit_price, @total, datetime('now'))
    `);
        return stmt.run(receipt);
    });
    electron_1.ipcMain.handle('db:query', (_event, sql, params) => {
        return db.prepare(sql).all(...(params || []));
    });
    // --- System operations ---
    electron_1.ipcMain.handle('system:notification', (_event, title, body) => {
        new electron_1.Notification({ title, body }).show();
        return true;
    });
    electron_1.ipcMain.handle('system:open-external', (_event, url) => {
        electron_1.shell.openExternal(url);
        return true;
    });
    electron_1.ipcMain.handle('system:app-version', () => {
        return electron_1.app.getVersion();
    });
    // --- Register export and print handlers ---
    (0, exporter_1.registerExportHandlers)();
    (0, printer_1.registerPrintHandlers)();
}
//# sourceMappingURL=ipc-handlers.js.map