"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const database_1 = require("./database");
const exporter_1 = require("./exporter");
const printer_1 = require("./printer");
/** Validate that an object has all required string fields and no excessively long values. */
function validateFields(obj, requiredStrings, optionalStrings = [], optionalNumbers = []) {
    if (!obj || typeof obj !== 'object')
        throw new Error('Invalid input: expected object');
    const rec = obj;
    for (const field of requiredStrings) {
        if (typeof rec[field] !== 'string' || rec[field] === '') {
            throw new Error(`Missing required field: ${field}`);
        }
        if (rec[field].length > 1000) {
            throw new Error(`Field too long: ${field}`);
        }
    }
    for (const field of optionalStrings) {
        if (rec[field] != null && typeof rec[field] !== 'string') {
            throw new Error(`Invalid field type: ${field}`);
        }
        if (typeof rec[field] === 'string' && rec[field].length > 1000) {
            throw new Error(`Field too long: ${field}`);
        }
    }
    for (const field of optionalNumbers) {
        if (rec[field] != null && typeof rec[field] !== 'number') {
            throw new Error(`Invalid field type: ${field}`);
        }
    }
    return rec;
}
function registerIpcHandlers() {
    const db = (0, database_1.getDatabase)();
    // --- Database operations ---
    electron_1.ipcMain.handle('db:get-products', () => {
        return db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY name').all();
    });
    electron_1.ipcMain.handle('db:save-product', (_event, product) => {
        const p = validateFields(product, ['id', 'name', 'unit'], ['vendor_id', 'name_creole', 'emoji', 'category'], ['current_price', 'cost_price', 'stock_quantity', 'low_stock_threshold']);
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO products (id, vendor_id, name, name_creole, emoji, category, unit, current_price, cost_price, stock_quantity, low_stock_threshold, is_active, updated_at)
      VALUES (@id, @vendor_id, @name, @name_creole, @emoji, @category, @unit, @current_price, @cost_price, @stock_quantity, @low_stock_threshold, @is_active, datetime('now'))
    `);
        return stmt.run(p);
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
        const t = validateFields(tx, ['id', 'transaction_type'], ['vendor_id', 'product_id', 'payment_method', 'moncash_reference', 'notes', 'receipt_number', 'employee_id', 'employee_name'], ['quantity', 'unit_price', 'total_amount']);
        const stmt = db.prepare(`
      INSERT INTO transactions (id, vendor_id, product_id, transaction_type, quantity, unit_price, total_amount, payment_method, moncash_reference, notes, receipt_number, employee_id, employee_name, created_at)
      VALUES (@id, @vendor_id, @product_id, @transaction_type, @quantity, @unit_price, @total_amount, @payment_method, @moncash_reference, @notes, @receipt_number, @employee_id, @employee_name, datetime('now'))
    `);
        return stmt.run(t);
    });
    electron_1.ipcMain.handle('db:get-customers', () => {
        return db.prepare('SELECT * FROM customers ORDER BY last_activity_date DESC').all();
    });
    electron_1.ipcMain.handle('db:save-customer', (_event, customer) => {
        const c = validateFields(customer, ['id', 'name'], ['vendor_id', 'phone', 'last_activity_date'], ['total_credit', 'total_paid', 'balance', 'trust_score']);
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO customers (id, vendor_id, name, phone, total_credit, total_paid, balance, trust_score, last_activity_date)
      VALUES (@id, @vendor_id, @name, @phone, @total_credit, @total_paid, @balance, @trust_score, @last_activity_date)
    `);
        return stmt.run(c);
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
        const e = validateFields(entry, ['id', 'customer_name', 'entry_type'], ['vendor_id', 'customer_id', 'customer_phone', 'description', 'due_date'], ['amount', 'balance_after']);
        const stmt = db.prepare(`
      INSERT INTO credit_entries (id, vendor_id, customer_id, customer_name, customer_phone, entry_type, amount, balance_after, description, due_date, created_at)
      VALUES (@id, @vendor_id, @customer_id, @customer_name, @customer_phone, @entry_type, @amount, @balance_after, @description, @due_date, datetime('now'))
    `);
        return stmt.run(e);
    });
    electron_1.ipcMain.handle('db:get-suppliers', () => {
        return db.prepare('SELECT * FROM suppliers ORDER BY name').all();
    });
    electron_1.ipcMain.handle('db:save-supplier', (_event, supplier) => {
        const s = validateFields(supplier, ['id', 'name'], ['vendor_id', 'phone', 'location', 'notes']);
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO suppliers (id, vendor_id, name, phone, location, notes)
      VALUES (@id, @vendor_id, @name, @phone, @location, @notes)
    `);
        return stmt.run(s);
    });
    electron_1.ipcMain.handle('db:get-receipts', () => {
        return db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all();
    });
    electron_1.ipcMain.handle('db:save-receipt', (_event, receipt) => {
        const r = validateFields(receipt, ['id', 'product_name'], [], ['quantity', 'unit_price', 'total']);
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (id, product_name, quantity, unit_price, total, created_at)
      VALUES (@id, @product_name, @quantity, @unit_price, @total, datetime('now'))
    `);
        return stmt.run(r);
    });
    // --- Employees ---
    electron_1.ipcMain.handle('db:get-employees', (_event, vendorId) => {
        const rows = db.prepare('SELECT * FROM employees WHERE vendor_id = ? ORDER BY name').all(vendorId);
        // Parse permissions JSON string back to array, and is_active integer to boolean
        return rows.map((r) => ({
            ...r,
            permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions,
            is_active: !!r.is_active,
        }));
    });
    electron_1.ipcMain.handle('db:save-employee', (_event, employee) => {
        // Serialize permissions array to JSON string for SQLite storage
        const input = { ...employee, permissions: Array.isArray(employee.permissions) ? JSON.stringify(employee.permissions) : employee.permissions };
        const e = validateFields(input, ['id', 'vendor_id', 'name', 'pin_hash', 'role', 'permissions'], ['last_login', 'created_at', 'updated_at']);
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO employees (id, vendor_id, name, pin_hash, role, permissions, is_active, last_login, created_at, updated_at)
      VALUES (@id, @vendor_id, @name, @pin_hash, @role, @permissions, @is_active, @last_login, @created_at, datetime('now'))
    `);
        return stmt.run({ ...e, is_active: e.is_active ? 1 : 0 });
    });
    electron_1.ipcMain.handle('db:update-employee', (_event, vendorId, employeeId, updates) => {
        const allowed = ['name', 'pin_hash', 'role', 'permissions', 'is_active', 'last_login'];
        const fields = Object.keys(updates).filter(k => allowed.includes(k));
        if (fields.length === 0)
            return;
        const sets = fields.map(k => `${k} = @${k}`).join(', ');
        const stmt = db.prepare(`UPDATE employees SET ${sets}, updated_at = datetime('now') WHERE id = @id AND vendor_id = @vendor_id`);
        const params = { ...updates, id: employeeId, vendor_id: vendorId };
        if ('is_active' in params)
            params.is_active = params.is_active ? 1 : 0;
        return stmt.run(params);
    });
    electron_1.ipcMain.handle('db:delete-employee', (_event, vendorId, employeeId) => {
        return db.prepare('DELETE FROM employees WHERE id = ? AND vendor_id = ?').run(employeeId, vendorId);
    });
    // --- System operations ---
    electron_1.ipcMain.handle('system:notification', (_event, title, body) => {
        new electron_1.Notification({ title, body }).show();
        return true;
    });
    electron_1.ipcMain.handle('system:open-external', (_event, url) => {
        // Only allow http/https URLs to prevent arbitrary protocol execution
        if (/^https?:\/\//i.test(url)) {
            electron_1.shell.openExternal(url);
            return true;
        }
        return false;
    });
    electron_1.ipcMain.handle('system:app-version', () => {
        return electron_1.app.getVersion();
    });
    // --- Register export and print handlers ---
    (0, exporter_1.registerExportHandlers)();
    (0, printer_1.registerPrintHandlers)();
}
//# sourceMappingURL=ipc-handlers.js.map