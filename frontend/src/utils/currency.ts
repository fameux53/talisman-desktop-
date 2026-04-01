import type { Locale } from '../i18n';

/**
 * Format a currency amount according to the active locale.
 * HT: "1,500 G"  |  FR: "1 500 HTG"  |  EN: "HTG 1,500"
 */
export function formatCurrency(amount: number, locale: Locale): string {
  const { number, suffix } = formatCurrencyParts(amount, locale);
  if (locale === 'en') return `${suffix}\u00A0${number}`;
  return `${number}\u00A0${suffix}`;
}

/**
 * Returns separated number and currency suffix for custom rendering.
 */
export function formatCurrencyParts(amount: number, locale: Locale): { number: string; suffix: string } {
  if (locale === 'fr') {
    return { number: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount), suffix: 'HTG' };
  }
  if (locale === 'en') {
    return { number: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount), suffix: 'HTG' };
  }
  return { number: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount), suffix: 'G' };
}
