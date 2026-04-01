// Data layer abstraction — routes calls to Electron SQLite or browser IndexedDB
//
// In Electron: uses the preload bridge → SQLite via IPC
// In browser:  uses the existing IndexedDB helpers from db.ts

import {
  getAllFromStore,
  getVendorRecords,
  putInStore,
  deleteFromStore,
  upsertCustomer,
  type ProductRecord,
  type TransactionRecord,
  type CreditRecord,
  type CustomerRecord,
  type ReceiptRecord,
  type SupplierRecord,
  type EmployeeRecord,
  type PerformanceReportRecord,
} from './db';

interface ElectronAPI {
  isElectron: boolean;
  db: {
    getProducts: () => Promise<ProductRecord[]>;
    saveProduct: (product: ProductRecord) => Promise<unknown>;
    deleteProduct: (id: string) => Promise<unknown>;
    getTransactions: (filters?: TransactionFilters) => Promise<TransactionRecord[]>;
    saveTransaction: (tx: TransactionRecord) => Promise<unknown>;
    getCustomers: () => Promise<CustomerRecord[]>;
    saveCustomer: (customer: CustomerRecord) => Promise<unknown>;
    getCreditEntries: (customerId?: string) => Promise<CreditRecord[]>;
    saveCreditEntry: (entry: CreditRecord) => Promise<unknown>;
    getSuppliers: () => Promise<SupplierRecord[]>;
    saveSupplier: (supplier: SupplierRecord) => Promise<unknown>;
    getReceipts: () => Promise<ReceiptRecord[]>;
    saveReceipt: (receipt: ReceiptRecord) => Promise<unknown>;
    getEmployees: (vendorId: string) => Promise<EmployeeRecord[]>;
    saveEmployee: (employee: EmployeeRecord) => Promise<unknown>;
    updateEmployee: (vendorId: string, employeeId: string, updates: unknown) => Promise<unknown>;
    deleteEmployee: (vendorId: string, employeeId: string) => Promise<unknown>;
  };
  export: {
    savePDF: (data: unknown, defaultName: string) => Promise<string | null>;
    saveCSV: (data: string, defaultName: string) => Promise<string | null>;
    backupDatabase: () => Promise<string | null>;
    restoreDatabase: () => Promise<string | null>;
  };
  print: {
    receipt: (html: string) => Promise<boolean>;
    report: (html: string) => Promise<boolean>;
    getPrinters: () => Promise<unknown[]>;
  };
}

interface TransactionFilters {
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  limit?: number;
}

function getElectronAPI(): ElectronAPI | null {
  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
  return api?.isElectron ? api : null;
}

export const isElectron = !!getElectronAPI();

/** Get the current vendor ID from localStorage (avoids circular import with authStore). */
function _getVendorId(): string {
  try {
    const stored = localStorage.getItem('tlsm_vendor');
    if (stored) return JSON.parse(stored).id ?? '';
  } catch { /* ignore */ }
  return '';
}

export const dataLayer = {
  // --- Products ---
  async getProducts(): Promise<ProductRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getProducts();
    const vid = _getVendorId();
    return vid ? getVendorRecords('products', vid) : getAllFromStore('products');
  },

  async saveProduct(product: ProductRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveProduct(product);
      return;
    }
    await putInStore('products', product);
  },

  async deleteProduct(id: string): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.deleteProduct(id);
      return;
    }
    await deleteFromStore('products', id);
  },

  // --- Transactions ---
  async getTransactions(filters?: TransactionFilters): Promise<TransactionRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getTransactions(filters);
    // Browser: get vendor-scoped records from IndexedDB, apply filters in-memory
    const vid = _getVendorId();
    const all = vid ? await getVendorRecords('transactions', vid) : await getAllFromStore('transactions');
    let result = all;
    if (filters?.type) result = result.filter((t) => t.transaction_type === filters.type);
    if (filters?.dateFrom) result = result.filter((t) => (t.created_at || '') >= filters.dateFrom!);
    if (filters?.dateTo) result = result.filter((t) => (t.created_at || '') <= filters.dateTo!);
    if (filters?.paymentMethod)
      result = result.filter((t) => t.payment_method === filters.paymentMethod);
    result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    if (filters?.limit) result = result.slice(0, filters.limit);
    return result;
  },

  async saveTransaction(tx: TransactionRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveTransaction(tx);
      return;
    }
    await putInStore('transactions', tx);
  },

  // --- Customers ---
  async getCustomers(): Promise<CustomerRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getCustomers();
    const vid = _getVendorId();
    return vid ? getVendorRecords('customers', vid) : getAllFromStore('customers');
  },

  async saveCustomer(customer: CustomerRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveCustomer(customer);
      return;
    }
    await putInStore('customers', customer);
  },

  async upsertCustomer(
    name: string,
    phone: string | undefined,
    creditAmount: number,
    isPayment: boolean
  ): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      // For Electron, fetch + update in renderer since SQLite has different schema
      const customers = await api.db.getCustomers();
      const existing = customers.find(
        (c) => (c as unknown as { name: string }).name === name
      ) as unknown as {
        id: string;
        name: string;
        phone?: string;
        totalCredit: number;
        totalPaid: number;
        balance: number;
        lastActivityDate: string;
        createdAt: string;
      } | undefined;
      const now = new Date().toISOString();
      if (existing) {
        const totalCredit = isPayment ? existing.totalCredit : existing.totalCredit + creditAmount;
        const totalPaid = isPayment ? existing.totalPaid + creditAmount : existing.totalPaid;
        await api.db.saveCustomer({
          ...existing,
          vendor_id: (existing as unknown as { vendor_id?: string }).vendor_id ?? '',
          totalCredit,
          totalPaid,
          balance: totalCredit - totalPaid,
          lastActivityDate: now,
          phone: phone || existing.phone,
        } as unknown as CustomerRecord);
      } else {
        await api.db.saveCustomer({
          id: crypto.randomUUID(),
          vendor_id: '',
          name,
          phone,
          totalCredit: isPayment ? 0 : creditAmount,
          totalPaid: isPayment ? creditAmount : 0,
          balance: isPayment ? -creditAmount : creditAmount,
          lastActivityDate: now,
          createdAt: now,
        } as unknown as CustomerRecord);
      }
      return;
    }
    await upsertCustomer(name, phone, creditAmount, isPayment);
  },

  // --- Credit entries ---
  async getCreditEntries(customerId?: string): Promise<CreditRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getCreditEntries(customerId);
    const vid = _getVendorId();
    const all = vid ? await getVendorRecords('creditEntries', vid) : await getAllFromStore('creditEntries');
    if (customerId) {
      return all.filter(
        (e) => (e as unknown as { customer_id?: string }).customer_id === customerId
      );
    }
    return all;
  },

  async saveCreditEntry(entry: CreditRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveCreditEntry(entry);
      return;
    }
    await putInStore('creditEntries', entry);
  },

  // --- Suppliers ---
  async getSuppliers(): Promise<SupplierRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getSuppliers();
    const vid = _getVendorId();
    return vid ? getVendorRecords('suppliers', vid) : getAllFromStore('suppliers');
  },

  async saveSupplier(supplier: SupplierRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveSupplier(supplier);
      return;
    }
    await putInStore('suppliers', supplier);
  },

  // --- Receipts ---
  async getReceipts(): Promise<ReceiptRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getReceipts();
    const vid = _getVendorId();
    return vid ? getVendorRecords('receipts', vid) : getAllFromStore('receipts');
  },

  async saveReceipt(receipt: ReceiptRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveReceipt(receipt);
      return;
    }
    await putInStore('receipts', receipt);
  },

  // --- Employees ---
  async getEmployees(vendorId: string): Promise<EmployeeRecord[]> {
    const api = getElectronAPI();
    if (api) return api.db.getEmployees(vendorId);
    return getVendorRecords('employees', vendorId);
  },

  async saveEmployee(employee: EmployeeRecord): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.saveEmployee(employee);
      return;
    }
    await putInStore('employees', employee);
  },

  async deleteEmployee(vendorId: string, employeeId: string): Promise<void> {
    const api = getElectronAPI();
    if (api) {
      await api.db.deleteEmployee(vendorId, employeeId);
      return;
    }
    await deleteFromStore('employees', employeeId);
  },

  // --- Performance Reports ---
  async getPerformanceReports(vendorId: string): Promise<PerformanceReportRecord[]> {
    const all = await getVendorRecords('performanceReports', vendorId);
    return (all as PerformanceReportRecord[]).sort((a, b) => b.generated_at.localeCompare(a.generated_at));
  },

  async savePerformanceReport(report: PerformanceReportRecord): Promise<void> {
    await putInStore('performanceReports', report);
  },

  // --- Export ---
  async exportPDF(defaultName: string): Promise<string | null> {
    const api = getElectronAPI();
    if (api) return api.export.savePDF(null, defaultName);
    window.print();
    return null;
  },

  async exportCSV(csvContent: string, defaultName: string): Promise<string | null> {
    const api = getElectronAPI();
    if (api) return api.export.saveCSV(csvContent, defaultName);
    // Browser: download as blob
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    return null;
  },

  // --- Print ---
  async printReceipt(html: string): Promise<boolean> {
    const api = getElectronAPI();
    if (api) return api.print.receipt(html);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.print();
    }
    return true;
  },

  // --- Backup / Restore ---
  async backupDatabase(): Promise<string | null> {
    const api = getElectronAPI();
    if (api) return api.export.backupDatabase();
    // Browser: no-op (PWA uses IndexedDB which persists in-browser)
    return null;
  },

  async restoreDatabase(): Promise<string | null> {
    const api = getElectronAPI();
    if (api) return api.export.restoreDatabase();
    return null;
  },
};
