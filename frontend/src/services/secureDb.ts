/**
 * Secure wrappers around IndexedDB operations that encrypt/decrypt
 * sensitive PII fields (phone numbers, customer names).
 */

import { getAllFromStore, getVendorRecords, putInStore, type CreditRecord, type CustomerRecord } from './db';
import { encryptSensitiveFields, decryptSensitiveFields } from '../utils/crypto';

// Fields containing PII that should be encrypted at rest
const CREDIT_PII_FIELDS: (keyof CreditRecord)[] = ['customer_name', 'customer_phone', 'description'];
const CUSTOMER_PII_FIELDS: (keyof CustomerRecord)[] = ['name', 'phone'];

// ── Credit entries ──

export async function putCreditEntrySecure(entry: CreditRecord): Promise<void> {
  const encrypted = await encryptSensitiveFields(entry as unknown as Record<string, unknown>, CREDIT_PII_FIELDS as string[]);
  await putInStore('creditEntries', encrypted as unknown as CreditRecord);
}

/** Get all credit entries for a specific vendor (decrypted). */
export async function getAllCreditEntriesSecure(vendorId?: string): Promise<CreditRecord[]> {
  const raw = vendorId
    ? await getVendorRecords('creditEntries', vendorId)
    : await getAllFromStore('creditEntries');
  return Promise.all(raw.map((r) => decryptSensitiveFields(r as unknown as Record<string, unknown>, CREDIT_PII_FIELDS as string[]))) as unknown as Promise<CreditRecord[]>;
}

// ── Customers ──

export async function putCustomerSecure(customer: CustomerRecord): Promise<void> {
  const encrypted = await encryptSensitiveFields(customer as unknown as Record<string, unknown>, CUSTOMER_PII_FIELDS as string[]);
  await putInStore('customers', encrypted as unknown as CustomerRecord);
}

/** Get all customers for a specific vendor (decrypted). */
export async function getAllCustomersSecure(vendorId?: string): Promise<CustomerRecord[]> {
  const raw = vendorId
    ? await getVendorRecords('customers', vendorId)
    : await getAllFromStore('customers');
  return Promise.all(raw.map((r) => decryptSensitiveFields(r as unknown as Record<string, unknown>, CUSTOMER_PII_FIELDS as string[]))) as unknown as Promise<CustomerRecord[]>;
}
