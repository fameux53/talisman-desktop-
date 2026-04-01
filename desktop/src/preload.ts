import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // Database operations (SQLite)
  db: {
    getProducts: () => ipcRenderer.invoke('db:get-products'),
    saveProduct: (product: unknown) => ipcRenderer.invoke('db:save-product', product),
    deleteProduct: (id: string) => ipcRenderer.invoke('db:delete-product', id),
    getTransactions: (filters: unknown) => ipcRenderer.invoke('db:get-transactions', filters),
    saveTransaction: (tx: unknown) => ipcRenderer.invoke('db:save-transaction', tx),
    getCustomers: () => ipcRenderer.invoke('db:get-customers'),
    saveCustomer: (customer: unknown) => ipcRenderer.invoke('db:save-customer', customer),
    getCreditEntries: (customerId?: string) =>
      ipcRenderer.invoke('db:get-credit-entries', customerId),
    saveCreditEntry: (entry: unknown) => ipcRenderer.invoke('db:save-credit-entry', entry),
    getSuppliers: () => ipcRenderer.invoke('db:get-suppliers'),
    saveSupplier: (supplier: unknown) => ipcRenderer.invoke('db:save-supplier', supplier),
    getReceipts: () => ipcRenderer.invoke('db:get-receipts'),
    saveReceipt: (receipt: unknown) => ipcRenderer.invoke('db:save-receipt', receipt),
    getEmployees: (vendorId: string) => ipcRenderer.invoke('db:get-employees', vendorId),
    saveEmployee: (employee: unknown) => ipcRenderer.invoke('db:save-employee', employee),
    updateEmployee: (vendorId: string, employeeId: string, updates: unknown) =>
      ipcRenderer.invoke('db:update-employee', vendorId, employeeId, updates),
    deleteEmployee: (vendorId: string, employeeId: string) =>
      ipcRenderer.invoke('db:delete-employee', vendorId, employeeId),
  },

  // File export
  export: {
    savePDF: (data: unknown, defaultName: string) =>
      ipcRenderer.invoke('export:save-pdf', data, defaultName),
    saveCSV: (data: string, defaultName: string) =>
      ipcRenderer.invoke('export:save-csv', data, defaultName),
    backupDatabase: () => ipcRenderer.invoke('export:backup-db'),
    restoreDatabase: () => ipcRenderer.invoke('export:restore-db'),
  },

  // Printing
  print: {
    receipt: (receiptHTML: string) => ipcRenderer.invoke('print:receipt', receiptHTML),
    report: (reportHTML: string) => ipcRenderer.invoke('print:report', reportHTML),
    getPrinters: () => ipcRenderer.invoke('print:get-printers'),
  },

  // System
  system: {
    showNotification: (title: string, body: string) =>
      ipcRenderer.invoke('system:notification', title, body),
    openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url),
    getAppVersion: () => ipcRenderer.invoke('system:app-version'),
  },

  // Navigation events from main process
  onNavigate: (callback: (route: string) => void) => {
    ipcRenderer.on('navigate', (_event, route) => callback(route));
  },
  onAction: (callback: (action: string) => void) => {
    ipcRenderer.on('action', (_event, action) => callback(action));
  },

  // Update events
  onUpdateStatus: (callback: (status: { status: string; version: string }) => void) => {
    ipcRenderer.on('update-status', (_event, status) => callback(status));
  },
});
