import { create } from 'zustand';
import api from '../services/api';
import { clearAllVendorData, type Permission, OWNER_PERMISSIONS } from '../services/db';

export interface Vendor {
  id: string;
  phone_number: string;
  display_name: string;
  preferred_language: string;
  market_zone: string | null;
  is_active: boolean;
}

export interface CurrentEmployee {
  id: string;
  name: string;
  role: 'owner' | 'assistant' | 'manager';
  permissions: Permission[];
}

const VENDOR_KEY = 'tlsm_vendor';
const EMPLOYEE_KEY = 'tlsm_employee';
const PHONE_HASH_KEY = 'tlsm_ph';

/**
 * Simple non-cryptographic hash for offline phone verification.
 * Returns a hex string with no recoverable PII.
 */
async function _hashPhone(phone: string): Promise<string> {
  const data = new TextEncoder().encode(phone);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Persist only non-sensitive vendor fields to localStorage. */
function _persistVendor(v: Vendor): void {
  // Exclude phone_number entirely — it lives server-side only
  const clean = {
    id: v.id,
    display_name: v.display_name,
    preferred_language: v.preferred_language,
    market_zone: v.market_zone,
    is_active: v.is_active,
    phone_number: '', // placeholder for type compatibility on hydrate
  };
  localStorage.setItem(VENDOR_KEY, JSON.stringify(clean));
}

/** Persist only non-sensitive employee fields to localStorage. */
function _persistEmployee(id: string, name: string, role: string): void {
  const safeRole = ['owner', 'assistant', 'manager'].includes(role) ? role : 'owner';
  const payload = `{"id":${JSON.stringify(String(id))},"name":${JSON.stringify(String(name))},"role":"${safeRole}"}`;
  // Base64-encode before storing so the value is not clear text in storage
  localStorage.setItem(EMPLOYEE_KEY, btoa(payload));
}

function _hydrateEmployee(stored: Record<string, unknown>, vendor: Vendor): CurrentEmployee {
  const role = (stored.role || 'owner') as 'owner' | 'assistant' | 'manager';
  return {
    id: (stored.id as string) || vendor.id,
    name: (stored.name as string) || vendor.display_name,
    role,
    permissions: role === 'owner' ? [...OWNER_PERMISSIONS] : [],
  };
}

interface AuthState {
  vendor: Vendor | null;
  currentEmployee: CurrentEmployee | null;
  isAuthenticated: boolean;
  hydrated: boolean;

  login: (phone: string, pin: string, employee?: { id: string; name: string; role: string; permissions: Permission[] }) => Promise<void>;
  setEmployee: (emp: CurrentEmployee | null) => void;
  logout: () => Promise<void>;
  clearVendor: () => void;
  hydrate: () => void;
  hasPermission: (perm: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  vendor: null,
  currentEmployee: null,
  isAuthenticated: false,
  hydrated: false,

  login: async (phone: string, pin: string, employee?: { id: string; name: string; role: string; permissions: Permission[] }) => {
    const employeeId = employee?.id ?? null;
    const role = employee?.role ?? 'owner';
    try {
      const { data } = await api.post<{ vendor: Vendor; role: string; employee_id: string | null }>('/auth/login', {
        phone_number: phone,
        pin,
        employee_id: employeeId,
        role,
      });
      const vendor = data.vendor;
      _persistVendor(vendor);
      void _hashPhone(phone).then(h => localStorage.setItem(PHONE_HASH_KEY, h));
      const currentEmployee: CurrentEmployee = employee
        ? { id: employee.id, name: employee.name, role: employee.role as 'owner' | 'assistant' | 'manager', permissions: employee.permissions }
        : { id: vendor.id, name: vendor.display_name, role: 'owner' as const, permissions: [...OWNER_PERMISSIONS] };
      _persistEmployee(currentEmployee.id, currentEmployee.name, currentEmployee.role);
      set({ vendor, currentEmployee, isAuthenticated: true });
    } catch (err) {
      // Employee login: allow offline fallback using cached vendor
      if (employee && !(err as { response?: unknown }).response) {
        try {
          const stored = localStorage.getItem(VENDOR_KEY);
          const storedHash = localStorage.getItem(PHONE_HASH_KEY);
          if (stored && storedHash) {
            const vendor: Vendor = JSON.parse(stored);
            const inputHash = await _hashPhone(phone);
            if (inputHash === storedHash) {
              const currentEmployee: CurrentEmployee = {
                id: employee.id, name: employee.name,
                role: employee.role as 'owner' | 'assistant' | 'manager',
                permissions: employee.permissions,
              };
              _persistEmployee(currentEmployee.id, currentEmployee.name, currentEmployee.role);
              set({ vendor, currentEmployee, isAuthenticated: true });
              return;
            }
          }
        } catch { /* corrupted localStorage, fall through */ }
      }
      throw err;
    }
  },

  setEmployee: (emp) => {
    if (emp) {
      _persistEmployee(emp.id, emp.name, emp.role);
    } else {
      localStorage.removeItem(EMPLOYEE_KEY);
    }
    set({ currentEmployee: emp });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem(VENDOR_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    localStorage.removeItem(PHONE_HASH_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tlsm_onboarding_') || key.startsWith('tlsm_catalog_setup_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    await clearAllVendorData();
    set({ vendor: null, currentEmployee: null, isAuthenticated: false });
  },

  clearVendor: () => {
    localStorage.removeItem(VENDOR_KEY);
    localStorage.removeItem(EMPLOYEE_KEY);
    localStorage.removeItem(PHONE_HASH_KEY);
    set({ vendor: null, currentEmployee: null, isAuthenticated: false });
  },

  hydrate: () => {
    const stored = localStorage.getItem(VENDOR_KEY);
    if (!stored) { set({ hydrated: true }); return; }

    try {
      const vendor: Vendor = JSON.parse(stored);
      const empRaw = localStorage.getItem(EMPLOYEE_KEY);
      const currentEmployee: CurrentEmployee = empRaw
        ? _hydrateEmployee(JSON.parse(atob(empRaw)), vendor)
        : { id: vendor.id, name: vendor.display_name, role: 'owner' as const, permissions: [...OWNER_PERMISSIONS] };
      set({ vendor, currentEmployee, isAuthenticated: true, hydrated: true });

      api.get<{ vendor: Vendor; role: string; employee_id: string | null }>('/auth/me').then(({ data }) => {
        const fresh: Vendor = data.vendor;
        const serverRole = (data.role || 'owner') as 'owner' | 'assistant' | 'manager';
        _persistVendor(fresh);
        void _hashPhone(fresh.phone_number).then(h => localStorage.setItem(PHONE_HASH_KEY, h));
        // Update employee with server-validated role (cannot be tampered with via localStorage)
        const freshEmployee: CurrentEmployee = {
          id: data.employee_id || fresh.id,
          name: currentEmployee.name,
          role: serverRole,
          permissions: serverRole === 'owner'
            ? [...OWNER_PERMISSIONS]
            : currentEmployee.permissions, // Preserve custom permissions set by owner
        };
        _persistEmployee(freshEmployee.id, freshEmployee.name, freshEmployee.role);
        set({ vendor: fresh, currentEmployee: freshEmployee, isAuthenticated: true });
      }).catch((err) => {
        // Only clear auth on explicit 401 (session expired / invalid token).
        // Do NOT clear on network errors, timeouts, or other transient failures
        // — this prevents logout when switching tabs or returning from external links.
        if (err?.response?.status === 401) {
          localStorage.removeItem(VENDOR_KEY);
          localStorage.removeItem(EMPLOYEE_KEY);
          localStorage.removeItem(PHONE_HASH_KEY);
          set({ vendor: null, currentEmployee: null, isAuthenticated: false });
        }
      });
    } catch {
      localStorage.removeItem(VENDOR_KEY);
      localStorage.removeItem(EMPLOYEE_KEY);
      localStorage.removeItem(PHONE_HASH_KEY);
      set({ hydrated: true });
    }
  },

  hasPermission: (perm) => {
    const { currentEmployee } = get();
    if (!currentEmployee) return false;
    if (currentEmployee.role === 'owner') return true;
    return currentEmployee.permissions.includes(perm);
  },
}));
