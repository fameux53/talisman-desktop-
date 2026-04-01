import { create } from 'zustand';

export type Theme = 'default' | 'dark';

const STORAGE_KEY = 'tlsm_theme';

function getStorageKey(vendorId?: string): string {
  return vendorId ? `${STORAGE_KEY}_${vendorId}` : STORAGE_KEY;
}

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0F1117' : '#2D6A4F');
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  hydrate: (vendorId?: string) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'default',

  toggle: () => {
    const next: Theme = get().theme === 'default' ? 'dark' : 'default';
    applyTheme(next);
    set({ theme: next });
    // Persist — try to find vendorId from localStorage keys
    try {
      const vendorId = JSON.parse(localStorage.getItem('tlsm_vendor') ?? '{}')?.id;
      localStorage.setItem(getStorageKey(vendorId), next);
    } catch {
      localStorage.setItem(STORAGE_KEY, next);
    }
  },

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
    try {
      const vendorId = JSON.parse(localStorage.getItem('tlsm_vendor') ?? '{}')?.id;
      localStorage.setItem(getStorageKey(vendorId), theme);
    } catch {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  },

  hydrate: (vendorId?: string) => {
    // Check per-vendor key first, then global fallback
    const saved = localStorage.getItem(getStorageKey(vendorId))
      ?? localStorage.getItem(STORAGE_KEY);
    const theme: Theme = saved === 'dark' ? 'dark' : 'default';
    applyTheme(theme);
    set({ theme });
  },
}));
