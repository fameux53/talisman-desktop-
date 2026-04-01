import { create } from 'zustand';
import htTranslations from './ht.json';
import frTranslations from './fr.json';
import enTranslations from './en.json';

export type Locale = 'ht' | 'fr' | 'en';

type Translations = Record<string, string>;

const translationMap: Record<Locale, Translations> = {
  ht: htTranslations,
  fr: frTranslations,
  en: enTranslations,
};

const STORAGE_KEY = 'marketmama_locale';

function loadLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in translationMap) return stored as Locale;
  return 'ht';
}

// Set initial HTML lang on load
const initialLocale = loadLocale();
document.documentElement.lang = initialLocale;

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const useI18n = create<I18nState>((set, get) => ({
  locale: initialLocale,

  setLocale: (locale: Locale) => {
    localStorage.setItem(STORAGE_KEY, locale);
    // Update HTML lang attribute for screen readers and browser features
    document.documentElement.lang = locale;
    set({ locale });
  },

  t: (key: string): string => {
    const { locale } = get();
    return translationMap[locale]?.[key] ?? translationMap.ht[key] ?? key;
  },
}));
