"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a safe API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,
    isElectron: true,
    // Database operations (SQLite)
    db: {
        getProducts: () => electron_1.ipcRenderer.invoke('db:get-products'),
        saveProduct: (product) => electron_1.ipcRenderer.invoke('db:save-product', product),
        deleteProduct: (id) => electron_1.ipcRenderer.invoke('db:delete-product', id),
        getTransactions: (filters) => electron_1.ipcRenderer.invoke('db:get-transactions', filters),
        saveTransaction: (tx) => electron_1.ipcRenderer.invoke('db:save-transaction', tx),
        getCustomers: () => electron_1.ipcRenderer.invoke('db:get-customers'),
        saveCustomer: (customer) => electron_1.ipcRenderer.invoke('db:save-customer', customer),
        getCreditEntries: (customerId) => electron_1.ipcRenderer.invoke('db:get-credit-entries', customerId),
        saveCreditEntry: (entry) => electron_1.ipcRenderer.invoke('db:save-credit-entry', entry),
        getSuppliers: () => electron_1.ipcRenderer.invoke('db:get-suppliers'),
        saveSupplier: (supplier) => electron_1.ipcRenderer.invoke('db:save-supplier', supplier),
        getReceipts: () => electron_1.ipcRenderer.invoke('db:get-receipts'),
        saveReceipt: (receipt) => electron_1.ipcRenderer.invoke('db:save-receipt', receipt),
        query: (sql, params) => electron_1.ipcRenderer.invoke('db:query', sql, params),
    },
    // File export
    export: {
        savePDF: (data, defaultName) => electron_1.ipcRenderer.invoke('export:save-pdf', data, defaultName),
        saveCSV: (data, defaultName) => electron_1.ipcRenderer.invoke('export:save-csv', data, defaultName),
        backupDatabase: () => electron_1.ipcRenderer.invoke('export:backup-db'),
        restoreDatabase: () => electron_1.ipcRenderer.invoke('export:restore-db'),
    },
    // Printing
    print: {
        receipt: (receiptHTML) => electron_1.ipcRenderer.invoke('print:receipt', receiptHTML),
        report: (reportHTML) => electron_1.ipcRenderer.invoke('print:report', reportHTML),
        getPrinters: () => electron_1.ipcRenderer.invoke('print:get-printers'),
    },
    // System
    system: {
        showNotification: (title, body) => electron_1.ipcRenderer.invoke('system:notification', title, body),
        openExternal: (url) => electron_1.ipcRenderer.invoke('system:open-external', url),
        getAppVersion: () => electron_1.ipcRenderer.invoke('system:app-version'),
    },
    // Navigation events from main process
    onNavigate: (callback) => {
        electron_1.ipcRenderer.on('navigate', (_event, route) => callback(route));
    },
    onAction: (callback) => {
        electron_1.ipcRenderer.on('action', (_event, action) => callback(action));
    },
    // Update events
    onUpdateStatus: (callback) => {
        electron_1.ipcRenderer.on('update-status', (_event, status) => callback(status));
    },
});
//# sourceMappingURL=preload.js.map