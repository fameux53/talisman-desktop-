import type { CreditRecord } from '../services/db';

export interface TrustResult {
  score: number; // 1-5
  label: 'excellent' | 'good' | 'average' | 'weak' | 'risky' | 'new';
}

const TRUST_COLORS: Record<string, { bg: string; text: string }> = {
  excellent: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  good: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  average: { bg: 'bg-amber-50', text: 'text-amber-600' },
  weak: { bg: 'bg-orange-50', text: 'text-orange-600' },
  risky: { bg: 'bg-red-50', text: 'text-red-600' },
  new: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

export function getTrustColors(label: string) {
  return TRUST_COLORS[label] ?? TRUST_COLORS.new;
}

export function getTrustStars(score: number): string {
  if (score <= 0) return '';
  return '⭐'.repeat(Math.min(score, 5));
}

export function calculateTrustScore(
  balance: number,
  entries: CreditRecord[],
): TrustResult {
  const credits = entries.filter((e) => e.entry_type === 'CREDIT_GIVEN');
  const payments = entries.filter((e) => e.entry_type === 'PAYMENT_RECEIVED');
  const totalCredits = credits.length;
  const totalPayments = payments.length;

  if (totalCredits === 0) return { score: 3, label: 'new' };

  const paymentRatio = totalPayments / totalCredits;

  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = credits.filter(
    (e) => e.due_date && e.due_date < today,
  ).length;
  const overdueRatio = overdueCount / totalCredits;

  const hasOverdueBalance = balance > 0 && overdueCount > 0;

  if (paymentRatio >= 0.9 && overdueRatio === 0 && !hasOverdueBalance)
    return { score: 5, label: 'excellent' };
  if (paymentRatio >= 0.7 && overdueRatio < 0.2)
    return { score: 4, label: 'good' };
  if (paymentRatio >= 0.5 || overdueRatio < 0.4)
    return { score: 3, label: 'average' };
  if (paymentRatio >= 0.3) return { score: 2, label: 'weak' };
  return { score: 1, label: 'risky' };
}
