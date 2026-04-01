import type { Locale } from '../i18n';

const DAYS_HT = ['Dimanch', 'Lendi', 'Madi', 'Mèkredi', 'Jedi', 'Vandredi', 'Samdi'];
const MONTHS_HT = ['Janvye', 'Fevriye', 'Mas', 'Avril', 'Me', 'Jen', 'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm'];

export function formatDate(date: Date, locale: Locale): string {
  if (locale === 'ht') {
    return `${DAYS_HT[date.getDay()]} ${date.getDate()} ${MONTHS_HT[date.getMonth()]} ${date.getFullYear()}`;
  }
  if (locale === 'fr') {
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
