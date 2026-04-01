/** Type declarations for the Electron preload bridge (window.electronAPI) */

interface ElectronDatabaseAPI {
  getProducts: () => Promise<unknown[]>;
  saveProduct: (product: unknown) => Promise<unknown>;
  deleteProduct: (id: string) => Promise<unknown>;
  getTransactions: (filters?: unknown) => Promise<unknown[]>;
  saveTransaction: (tx: unknown) => Promise<unknown>;
  getCustomers: () => Promise<unknown[]>;
  saveCustomer: (customer: unknown) => Promise<unknown>;
  getCreditEntries: (customerId?: string) => Promise<unknown[]>;
  saveCreditEntry: (entry: unknown) => Promise<unknown>;
  getSuppliers: () => Promise<unknown[]>;
  saveSupplier: (supplier: unknown) => Promise<unknown>;
  getReceipts: () => Promise<unknown[]>;
  saveReceipt: (receipt: unknown) => Promise<unknown>;
  query: (sql: string, params: unknown[]) => Promise<unknown[]>;
}

interface ElectronExportAPI {
  savePDF: (data: unknown, defaultName: string) => Promise<string | null>;
  saveCSV: (data: string, defaultName: string) => Promise<string | null>;
  backupDatabase: () => Promise<string | null>;
  restoreDatabase: () => Promise<string | null>;
}

interface ElectronPrintAPI {
  receipt: (html: string) => Promise<boolean>;
  report: (html: string) => Promise<boolean>;
  getPrinters: () => Promise<unknown[]>;
}

interface ElectronSystemAPI {
  showNotification: (title: string, body: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
}

interface ElectronAPI {
  platform: string;
  isElectron: true;
  db: ElectronDatabaseAPI;
  export: ElectronExportAPI;
  print: ElectronPrintAPI;
  system: ElectronSystemAPI;
  onNavigate: (callback: (route: string) => void) => void;
  onAction: (callback: (action: string) => void) => void;
  onUpdateStatus: (callback: (status: { status: string; version: string }) => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
