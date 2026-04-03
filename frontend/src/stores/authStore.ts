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

/** Strip sensitive fields before persisting to localStorage. */
function _safeVendor(v: Vendor): Omit<Vendor, 'phone_number'> & { phone_number: string } {
  // Mask phone number to last 4 digits for offline display; full number lives server-side only
  return { ...v, phone_number: v.phone_number.replace(/.(?=.{4})/g, '*') };
}

function _safeEmployee(e: CurrentEmployee): Record<string, unknown> {
  // Store only id, name, and role — permissions are re-derived from role on hydrate
  return { id: e.id, name: e.name, role: e.role };
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
      localStorage.setItem(VENDOR_KEY, JSON.stringify(_safeVendor(vendor)));
      const currentEmployee: CurrentEmployee = employee
        ? { id: employee.id, name: employee.name, role: employee.role as 'owner' | 'assistant' | 'manager', permissions: employee.permissions }
        : { id: vendor.id, name: vendor.display_name, role: 'owner' as const, permissions: [...OWNER_PERMISSIONS] };
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(_safeEmployee(currentEmployee)));
      set({ vendor, currentEmployee, isAuthenticated: true });
    } catch (err) {
      // Employee login: allow offline fallback using cached vendor
      if (employee && !(err as { response?: unknown }).response) {
        try {
          const stored = localStorage.getItem(VENDOR_KEY);
          if (stored) {
            const vendor: Vendor = JSON.parse(stored);
            if (vendor.phone_number === phone) {
              const currentEmployee: CurrentEmployee = {
                id: employee.id, name: employee.name,
                role: employee.role as 'owner' | 'assistant' | 'manager',
                permissions: employee.permissions,
              };
              localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(_safeEmployee(currentEmployee)));
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
      localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(emp));
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
    set({ vendor: null, currentEmployee: null, isAuthenticated: false });
  },

  hydrate: () => {
    const stored = localStorage.getItem(VENDOR_KEY);
    if (!stored) { set({ hydrated: true }); return; }

    try {
      const vendor: Vendor = JSON.parse(stored);
      const empStored = localStorage.getItem(EMPLOYEE_KEY);
      const currentEmployee: CurrentEmployee = empStored
        ? _hydrateEmployee(JSON.parse(empStored), vendor)
        : { id: vendor.id, name: vendor.display_name, role: 'owner' as const, permissions: [...OWNER_PERMISSIONS] };
      set({ vendor, currentEmployee, isAuthenticated: true, hydrated: true });

      api.get<{ vendor: Vendor; role: string; employee_id: string | null }>('/auth/me').then(({ data }) => {
        const fresh: Vendor = data.vendor;
        const serverRole = (data.role || 'owner') as 'owner' | 'assistant' | 'manager';
        localStorage.setItem(VENDOR_KEY, JSON.stringify(_safeVendor(fresh)));
        // Update employee with server-validated role (cannot be tampered with via localStorage)
        const freshEmployee: CurrentEmployee = {
          id: data.employee_id || fresh.id,
          name: currentEmployee.name,
          role: serverRole,
          permissions: serverRole === 'owner'
            ? [...OWNER_PERMISSIONS]
            : currentEmployee.permissions, // Preserve custom permissions set by owner
        };
        localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(_safeEmployee(freshEmployee)));
        set({ vendor: fresh, currentEmployee: freshEmployee, isAuthenticated: true });
      }).catch((err) => {
        // Only clear auth on explicit 401 (session expired / invalid token).
        // Do NOT clear on network errors, timeouts, or other transient failures
        // — this prevents logout when switching tabs or returning from external links.
        if (err?.response?.status === 401) {
          localStorage.removeItem(VENDOR_KEY);
          localStorage.removeItem(EMPLOYEE_KEY);
          set({ vendor: null, currentEmployee: null, isAuthenticated: false });
        }
      });
    } catch {
      localStorage.removeItem(VENDOR_KEY);
      localStorage.removeItem(EMPLOYEE_KEY);
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
