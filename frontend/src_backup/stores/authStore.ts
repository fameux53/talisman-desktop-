import { create } from 'zustand';
import api from '../services/api';

export interface Vendor {
  id: string;
  phone_number: string;
  display_name: string;
  preferred_language: string;
  market_zone: string | null;
  is_active: boolean;
}

const VENDOR_KEY = 'mm_vendor';

interface AuthState {
  vendor: Vendor | null;
  isAuthenticated: boolean;

  login: (phone: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  clearVendor: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  vendor: null,
  isAuthenticated: false,

  login: async (phone, pin) => {
    const { data } = await api.post<{ vendor: Vendor }>('/auth/login', {
      phone_number: phone,
      pin,
    });
    // Tokens are in httpOnly cookies — we only store the vendor object
    const vendor = data.vendor;
    localStorage.setItem(VENDOR_KEY, JSON.stringify(vendor));
    set({ vendor, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — cookie may already be expired
    }
    localStorage.removeItem(VENDOR_KEY);
    set({ vendor: null, isAuthenticated: false });
  },

  clearVendor: () => {
    localStorage.removeItem(VENDOR_KEY);
    set({ vendor: null, isAuthenticated: false });
  },

  hydrate: () => {
    // Restore vendor from localStorage (tokens are in httpOnly cookies)
    const stored = localStorage.getItem(VENDOR_KEY);
    if (!stored) return;

    try {
      const vendor: Vendor = JSON.parse(stored);
      set({ vendor, isAuthenticated: true });

      // Verify the cookie is still valid in the background
      api.get('/auth/me').then(({ data }) => {
        const fresh: Vendor = data.vendor;
        localStorage.setItem(VENDOR_KEY, JSON.stringify(fresh));
        set({ vendor: fresh, isAuthenticated: true });
      }).catch(() => {
        // Cookie expired or invalid — but don't kick user out if offline
        if (navigator.onLine) {
          localStorage.removeItem(VENDOR_KEY);
          set({ vendor: null, isAuthenticated: false });
        }
        // If offline, keep the local vendor — user can still use the app
      });
    } catch {
      localStorage.removeItem(VENDOR_KEY);
    }
  },
}));
