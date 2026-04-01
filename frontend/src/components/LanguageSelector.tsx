import { useI18n, type Locale } from '../i18n';

const options: { value: Locale; flag: string }[] = [
  { value: 'ht', flag: 'HT' },
  { value: 'fr', flag: 'FR' },
  { value: 'en', flag: 'EN' },
];

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="font-body text-xs font-medium bg-[var(--c-bg)] text-[var(--c-text2)] border border-[var(--c-border)] rounded-full px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)]"
      aria-label="Language"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.flag}</option>
      ))}
    </select>
  );
}
