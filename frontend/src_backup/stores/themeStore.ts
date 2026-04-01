import { create } from 'zustand';

export type Theme = 'default' | 'high-contrast';

const STORAGE_KEY = 'mm_theme';

function loadTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'high-contrast') return 'high-contrast';
  return 'default';
}

function applyTheme(theme: Theme) {
  if (theme === 'high-contrast') {
    document.documentElement.setAttribute('data-theme', 'high-contrast');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: loadTheme(),

  toggle: () => {
    const next: Theme = get().theme === 'default' ? 'high-contrast' : 'default';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },

  hydrate: () => {
    applyTheme(get().theme);
  },
}));
