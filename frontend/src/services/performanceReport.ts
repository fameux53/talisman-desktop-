import { dataLayer } from './dataLayer';
import { type PerformanceReportRecord, type TransactionRecord } from './db';

/**
 * Calculate the bi-weekly period to report on.
 * Periods: 1st–15th and 16th–end of month.
 * Always reports on the PREVIOUS completed period.
 */
function getReportPeriod(): { start: string; end: string; periodDays: number } {
  const now = new Date();
  const day = now.getDate();
  let s: Date, e: Date;

  if (day <= 15) {
    // Report on previous month's 16th–last day
    s = new Date(now.getFullYear(), now.getMonth() - 1, 16);
    e = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  } else {
    // Report on this month's 1st–15th
    s = new Date(now.getFullYear(), now.getMonth(), 1);
    e = new Date(now.getFullYear(), now.getMonth(), 15);
  }

  const start = fmt(s);
  const end = fmt(e);
  const periodDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return { start, end, periodDays };
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPriorPeriod(start: string, periodDays: number): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(s);
  e.setDate(e.getDate() - 1);
  const ps = new Date(s);
  ps.setDate(ps.getDate() - periodDays);
  return { start: fmt(ps), end: fmt(e) };
}

function filterByDate(txs: TransactionRecord[], from: string, to: string): TransactionRecord[] {
  return txs.filter(tx => {
    const d = (tx.created_at ?? '').slice(0, 10);
    return d >= from && d <= to;
  });
}

export async function generatePerformanceReport(vendorId: string): Promise<PerformanceReportRecord> {
  const { start, end, periodDays } = getReportPeriod();

  // Load all transactions and employees
  const allTx = await dataLayer.getTransactions();
  const vendorTx = allTx.filter(tx => tx.vendor_id === vendorId);
  const periodTx = filterByDate(vendorTx, start, end);
  const sales = periodTx.filter(tx => tx.transaction_type === 'SALE');

  // Prior period for trend
  const prior = getPriorPeriod(start, periodDays);
  const priorSales = filterByDate(vendorTx, prior.start, prior.end).filter(tx => tx.transaction_type === 'SALE');

  // Get employees + vendor name
  const employees = await dataLayer.getEmployees(vendorId);
  const vendorJson = localStorage.getItem('tlsm_vendor');
  const vendorName = vendorJson ? JSON.parse(vendorJson).display_name : 'Owner';

  // Load products for names
  const products = await dataLayer.getProducts();
  const productMap = new Map(products.map(p => [p.id, p]));

  // Build people list
  const people: { id: string | null; name: string; role: string; isOwner: boolean }[] = [
    { id: null, name: vendorName, role: 'owner', isOwner: true },
    ...employees.map(e => ({ id: e.id, name: e.name, role: e.role, isOwner: false })),
  ];

  const performances = people.map(person => {
    const mine = sales.filter(tx => person.isOwner ? !tx.employee_id : tx.employee_id === person.id);
    const prevMine = priorSales.filter(tx => person.isOwner ? !tx.employee_id : tx.employee_id === person.id);

    const revenue = mine.reduce((s, tx) => s + Number(tx.total_amount), 0);
    const prevRevenue = prevMine.reduce((s, tx) => s + Number(tx.total_amount), 0);
    const productsSold = mine.reduce((s, tx) => s + Number(tx.quantity), 0);
    const uniqueDays = new Set(mine.map(tx => (tx.created_at ?? '').slice(0, 10))).size;

    // Top products
    const prodAgg = new Map<string, { name: string; emoji: string; qty: number; rev: number }>();
    mine.forEach(tx => {
      const pid = tx.product_id ?? '';
      const p = productMap.get(pid);
      const entry = prodAgg.get(pid) ?? { name: p?.name ?? '—', emoji: (p as any)?.emoji ?? '📦', qty: 0, rev: 0 };
      entry.qty += Number(tx.quantity);
      entry.rev += Number(tx.total_amount);
      prodAgg.set(pid, entry);
    });
    const topProducts = [...prodAgg.values()].sort((a, b) => b.rev - a.rev).slice(0, 5)
      .map(p => ({ name: p.name, emoji: p.emoji, quantity: Math.round(p.qty), revenue: Math.round(p.rev) }));

    return {
      employee_id: person.id,
      name: person.name,
      role: person.role,
      is_owner: person.isOwner,
      metrics: {
        revenue: Math.round(revenue),
        transaction_count: mine.length,
        products_sold: Math.round(productsSold),
        average_transaction_value: mine.length > 0 ? Math.round(revenue / mine.length) : 0,
        largest_sale: mine.length > 0 ? Math.round(Math.max(...mine.map(tx => Number(tx.total_amount)))) : 0,
        days_worked: uniqueDays,
        revenue_per_day: uniqueDays > 0 ? Math.round(revenue / uniqueDays) : 0,
        credit_given: Math.round(mine.filter(tx => tx.payment_method === 'credit').reduce((s, tx) => s + Number(tx.total_amount), 0)),
        moncash_collected: Math.round(mine.filter(tx => tx.payment_method === 'moncash').reduce((s, tx) => s + Number(tx.total_amount), 0)),
      },
      top_products: topProducts,
      comparison: {
        revenue_rank: 0,
        revenue_vs_average: 0,
        trend_vs_last_period: prevRevenue > 0
          ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
          : revenue > 0 ? 100 : 0,
      },
    };
  });

  // Rankings
  const sorted = [...performances].sort((a, b) => b.metrics.revenue - a.metrics.revenue);
  const avgRev = performances.reduce((s, p) => s + p.metrics.revenue, 0) / (performances.length || 1);
  sorted.forEach((p, i) => {
    p.comparison.revenue_rank = i + 1;
    p.comparison.revenue_vs_average = avgRev > 0 ? Math.round(((p.metrics.revenue - avgRev) / avgRev) * 100) : 0;
  });

  const report: PerformanceReportRecord = {
    id: crypto.randomUUID(),
    vendor_id: vendorId,
    period_start: start,
    period_end: end,
    generated_at: new Date().toISOString(),
    is_read: false,
    summary: {
      total_revenue: Math.round(sales.reduce((s, tx) => s + Number(tx.total_amount), 0)),
      total_transactions: sales.length,
      total_products_sold: Math.round(sales.reduce((s, tx) => s + Number(tx.quantity), 0)),
    },
    employees: performances,
  };

  await dataLayer.savePerformanceReport(report);
  return report;
}

/** Check if a new report should be generated (on 1st or 16th of month). */
export async function maybeGenerateReport(vendorId: string): Promise<PerformanceReportRecord | null> {
  const employees = await dataLayer.getEmployees(vendorId);
  if (employees.length === 0) return null;

  const now = new Date();
  const day = now.getDate();
  if (day !== 1 && day !== 16) return null;

  const existing = await dataLayer.getPerformanceReports(vendorId);
  const today = fmt(now);
  if (existing.some(r => r.generated_at.startsWith(today))) return null;

  return generatePerformanceReport(vendorId);
}
