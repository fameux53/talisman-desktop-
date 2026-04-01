/**
 * Secure wrappers around IndexedDB operations that encrypt/decrypt
 * sensitive PII fields (phone numbers, customer names).
 */

import { getAllFromStore, putInStore, type CreditRecord, type CustomerRecord } from './db';
import { encryptSensitiveFields, decryptSensitiveFields } from '../utils/crypto';

// Fields containing PII that should be encrypted at rest
const CREDIT_PII_FIELDS: (keyof CreditRecord)[] = ['customer_name', 'customer_phone', 'description'];
const CUSTOMER_PII_FIELDS: (keyof CustomerRecord)[] = ['name', 'phone'];

// ── Credit entries ──

export async function putCreditEntrySecure(entry: CreditRecord): Promise<void> {
  const encrypted = await encryptSensitiveFields(entry, CREDIT_PII_FIELDS);
  await putInStore('creditEntries', encrypted);
}

export async function getAllCreditEntriesSecure(): Promise<CreditRecord[]> {
  const raw = await getAllFromStore('creditEntries');
  return Promise.all(raw.map((r) => decryptSensitiveFields(r, CREDIT_PII_FIELDS)));
}

// ── Customers ──

export async function putCustomerSecure(customer: CustomerRecord): Promise<void> {
  const encrypted = await encryptSensitiveFields(customer, CUSTOMER_PII_FIELDS);
  await putInStore('customers', encrypted);
}

export async function getAllCustomersSecure(): Promise<CustomerRecord[]> {
  const raw = await getAllFromStore('customers');
  return Promise.all(raw.map((r) => decryptSensitiveFields(r, CUSTOMER_PII_FIELDS)));
}
