import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Area, AreaChart, ReferenceLine,
} from 'recharts';
import {
  RiShareForwardFill, RiArrowUpLine, RiArrowDownLine, RiSubtractLine, RiBarChart2Fill,
  RiPrinterLine,
} from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useProducts } from '../hooks/useProducts';
import { useProductMap } from '../hooks/useProductMap';
import { useCountUp } from '../hooks/useCountUp';
import Toast from '../components/Toast';
import api from '../services/api';
import { getVendorRecords, type TransactionRecord, type ExpenseRecord } from '../services/db';
import { getLocalToday, getWeekStart, getMonthStart, toLocalDate } from '../utils/dateRange';
import { useAuthStore } from '../stores/authStore';

type Period = 'today' | 'week' | 'month';

function startOf(period: Period, offset = 0): string {
  if (period === 'today') {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (period === 'week') return getWeekStart(offset);
  return getMonthStart(offset);
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

export default function ReportsPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { products: _products } = useProducts();
  const { productMap } = useProductMap();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const [period, setPeriod] = useState<Period>('week');
  const [empFilter, setEmpFilter] = useState<string>('all');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [priorTransactions, setPriorTransactions] = useState<TransactionRecord[]>([]);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const dateFrom = useMemo(() => startOf(period), [period]);
  const dateTo = useMemo(() => getLocalToday(), []);
  const priorFrom = useMemo(() => startOf(period, 1), [period]);
  const priorTo = useMemo(() => {
    const d = new Date(dateFrom + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, [dateFrom]);

  // Fetch current + prior period
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const [cur, prior] = await Promise.all([
          api.get<TransactionRecord[]>('/transactions', { params: { date_from: dateFrom, limit: 200 } }),
          api.get<TransactionRecord[]>('/transactions', { params: { date_from: priorFrom, date_to: priorTo, limit: 200 } }),
        ]);
        // Merge API data with any unsynced local transactions to match dashboard
        const localAll = await getVendorRecords('transactions', vendorId);
        const localPeriod = localAll.filter((tx) => toLocalDate(tx.created_at) >= dateFrom && toLocalDate(tx.created_at) <= dateTo);
        const apiIds = new Set(cur.data.map((d) => d.id));
        const merged = [...cur.data, ...localPeriod.filter((l) => !apiIds.has(l.id))];
        setTransactions(merged);
        setPriorTransactions(prior.data);
      } else {
        const all = await getVendorRecords('transactions', vendorId);
        setTransactions(all.filter((tx) => toLocalDate(tx.created_at) >= dateFrom && toLocalDate(tx.created_at) <= dateTo));
        setPriorTransactions([]);
      }
    } catch {
      const all = await getVendorRecords('transactions', vendorId);
      setTransactions(all.filter((tx) => toLocalDate(tx.created_at) >= dateFrom && toLocalDate(tx.created_at) <= dateTo));
      setPriorTransactions([]);
    } finally {
      // Fetch expenses for the period
      const allExp = await getVendorRecords('expenses', vendorId);
      setExpenseRecords(allExp.filter((e) => e.date >= dateFrom && e.date <= dateTo));
      setLoading(false);
    }
  }, [dateFrom, priorFrom, priorTo, dateTo, vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  // --- Employee filter applied to all report data ---
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    transactions.forEach((tx) => { if (tx.employee_id && tx.employee_name) map.set(tx.employee_id, tx.employee_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [transactions]);

  const filteredTx = useMemo(() => {
    if (empFilter === 'all') return transactions;
    if (empFilter === 'owner') return transactions.filter((tx) => !tx.employee_id);
    return transactions.filter((tx) => tx.employee_id === empFilter);
  }, [transactions, empFilter]);

  // --- Stats ---
  const revenue = useMemo(() => sumByType(filteredTx, 'SALE'), [filteredTx]);
  const cogs = useMemo(() => sumByType(filteredTx, 'PURCHASE'), [filteredTx]);
  const operatingExpenses = useMemo(() => expenseRecords.reduce((s, e) => s + e.amount, 0), [expenseRecords]);
  const expenses = cogs + operatingExpenses; // total outflow
  const profit = revenue - expenses; // true profit
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  // Expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const catEmojis: Record<string, string> = { rent: '🏠', transport: '🚐', phone: '📱', salary: '💰', fuel: '⛽', supplies: '🛒', other: '📋' };
    const map = new Map<string, number>();
    for (const e of expenseRecords) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([cat, total]) => ({ cat, emoji: catEmojis[cat] ?? '📋', total }))
      .sort((a, b) => b.total - a.total);
  }, [expenseRecords]);

  const priorRevenue = useMemo(() => sumByType(priorTransactions, 'SALE'), [priorTransactions]);
  const revenueDelta = priorRevenue > 0 ? Math.round(((revenue - priorRevenue) / priorRevenue) * 100) : 0;

  const numDays = daysBetween(dateFrom, dateTo);
  const avgDaily = numDays > 0 ? Math.round(revenue / numDays) : 0;

  // --- Chart data ---
  const dailyData = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    for (const tx of filteredTx) {
      const d = toLocalDate((tx as TransactionRecord & { created_at?: string }).created_at);
      const entry = map.get(d) ?? { revenue: 0, expenses: 0 };
      if (tx.transaction_type === 'SALE') entry.revenue += Number(tx.total_amount);
      if (tx.transaction_type === 'PURCHASE') entry.expenses += Number(tx.total_amount);
      map.set(d, entry);
    }
    return Array.from(map.entries())
      .map(([date, vals]) => ({
        date: date.slice(5), // MM-DD
        fullDate: date,
        revenue: vals.revenue,
        expenses: vals.expenses,
        profit: vals.revenue - vals.expenses,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));
  }, [filteredTx, dateTo]);

  // Trend line: cumulative revenue
  const trendData = useMemo(() => {
    let cum = 0;
    return dailyData.map((d) => {
      cum += d.revenue;
      return { ...d, cumulative: cum };
    });
  }, [dailyData]);

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { revenue: number; emoji?: string }>();
    for (const tx of filteredTx) {
      if (tx.transaction_type !== 'SALE') continue;
      // Resolve product name: use ALL products (active + archived)
      const product = tx.product_id ? (productMap.get(tx.product_id) ?? null) : null;
      let name: string;
      if (product) {
        name = product.is_active === false
          ? `${product.name} ${t('reports.archived_suffix')}`
          : product.name;
      } else if (tx.product_id) {
        name = t('reports.unknown_product'); // permanently deleted
      } else {
        name = t('reports.unknown_product');
      }
      const existing = map.get(name) ?? { revenue: 0, emoji: undefined };
      existing.revenue += Number(tx.total_amount);
      if (!existing.emoji && product) existing.emoji = (product as any).emoji;
      map.set(name, existing);
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, revenue: data.revenue, emoji: data.emoji }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredTx, productMap, t]);

  const revenueLabel = period === 'today' ? t('label.daily_revenue') : period === 'week' ? t('label.weekly_revenue') : t('label.monthly_revenue');
  const maxProductRevenue = topProducts[0]?.revenue ?? 1;
  const RANK_COLORS = ['bg-[#FFD166]', 'bg-gray-300', 'bg-[#F4A261]'];

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const sales = filteredTx.filter((tx) => tx.transaction_type === 'SALE');
    const totalSales = sales.length;
    if (totalSales === 0) return null;
    const cash = sales.filter((tx) => !tx.payment_method || tx.payment_method === 'cash');
    const moncash = sales.filter((tx) => tx.payment_method === 'moncash');
    const credit = sales.filter((tx) => tx.payment_method === 'credit');
    const cashAmt = cash.reduce((s, tx) => s + Number(tx.total_amount), 0);
    const moncashAmt = moncash.reduce((s, tx) => s + Number(tx.total_amount), 0);
    const creditAmt = credit.reduce((s, tx) => s + Number(tx.total_amount), 0);
    const totalAmt = cashAmt + moncashAmt + creditAmt || 1;
    return [
      { label: t('payment.cash'), emoji: '💵', amount: cashAmt, pct: Math.round((cashAmt / totalAmt) * 100), color: 'bg-[var(--c-primary)]' },
      { label: t('payment.moncash'), emoji: '📱', amount: moncashAmt, pct: Math.round((moncashAmt / totalAmt) * 100), color: 'bg-[#F4A261]' },
      { label: t('payment.credit'), emoji: '📝', amount: creditAmt, pct: Math.round((creditAmt / totalAmt) * 100), color: 'bg-[#E76F51]' },
    ];
  }, [filteredTx, t]);

  // Sales by employee breakdown (always uses unfiltered transactions for full picture)
  const employeeSales = useMemo(() => {
    const vendorName = useAuthStore.getState().vendor?.display_name ?? '';
    const sales = transactions.filter((tx) => tx.transaction_type === 'SALE');
    const map = new Map<string, { name: string; isOwner: boolean; count: number; total: number }>();
    for (const tx of sales) {
      const key = tx.employee_id || 'owner';
      const entry = map.get(key) ?? { name: tx.employee_name || vendorName, isOwner: !tx.employee_id, count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(tx.total_amount);
      map.set(key, entry);
    }
    const results = Array.from(map.values());
    const totalRev = results.reduce((s, e) => s + e.total, 0) || 1;
    results.forEach((e) => { (e as any).pct = Math.round((e.total / totalRev) * 100); });
    return results.sort((a, b) => b.total - a.total);
  }, [transactions]);

  const hasData = revenue > 0 || expenses > 0;

  // --- Share ---
  const handleShare = () => {
    const dateLocale = locale === 'ht' ? 'fr-HT' : locale;
    const today = new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
    const cur = t('label.currency');
    const topList = topProducts.slice(0, 3).map((p) => `${p.name} (${p.revenue.toLocaleString()} ${cur})`).join(', ');
    const text = [
      `\u{1F4CA} Talisman ${t('nav.reports')} \u2014 ${today}`,
      `\u{1F4B0} ${t('label.revenue')}: ${revenue.toLocaleString()} ${cur}`,
      `\u{1F4C9} ${t('label.expenses')}: ${expenses.toLocaleString()} ${cur}`,
      `${profit >= 0 ? '\u2705' : '\u{1F534}'} ${t('label.profit')}: ${profit.toLocaleString()} ${cur}`,
      topList ? `${t('label.top_products')}: ${topList}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setToast(t('message.report_copied'));
      setTimeout(() => setToast(''), 2500);
    });
  };

  // --- Print / Download PDF ---
  const handlePrint = () => {
    const printLocale = locale === 'ht' ? 'fr-HT' : locale;
    const today = new Date().toLocaleDateString(printLocale, { day: 'numeric', month: 'long', year: 'numeric' });
    const cur = t('label.currency');
    const periodLabel = t(`period.${period}`);

    const topRows = topProducts.map((p, i) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${i + 1}. ${p.name}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${p.revenue.toLocaleString()} ${cur}</td></tr>`
    ).join('');

    const dailyRows = dailyData.map((d) =>
      `<tr><td style="padding:4px 12px;border-bottom:1px solid #f3f4f6">${d.date}</td><td style="padding:4px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${d.revenue.toLocaleString()} ${cur}</td><td style="padding:4px 12px;border-bottom:1px solid #f3f4f6;text-align:right">${d.expenses.toLocaleString()} ${cur}</td></tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Talisman — ${t('nav.reports')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',system-ui,sans-serif;color:#111827;padding:40px;max-width:800px;margin:0 auto}
h1,h2,h3{font-family:'Nunito',system-ui,sans-serif}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #2D6A4F;padding-bottom:16px;margin-bottom:24px}
.logo{font-size:24px;font-weight:800;color:#2D6A4F}
.meta{text-align:right;font-size:13px;color:#6B7280}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
.stat{background:#F0FDF4;border-radius:12px;padding:16px;text-align:center}
.stat-value{font-size:24px;font-weight:800;color:#2D6A4F}
.stat-label{font-size:12px;color:#6B7280;margin-top:4px}
.stat.expense{background:#FFF7ED}.stat.expense .stat-value{color:#F4A261}
.stat.profit-pos{background:#F0FDF4}.stat.profit-neg{background:#FEF2F2}
.stat.profit-neg .stat-value{color:#E76F51}
.section{margin-bottom:24px}
.section h2{font-size:16px;font-weight:700;margin-bottom:8px;color:#111827}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;padding:8px 12px;background:#F4F5F7;font-weight:600;font-size:12px;text-transform:uppercase;color:#6B7280}
th:last-child{text-align:right}
.summary{display:flex;gap:24px;font-size:14px;color:#6B7280;margin-bottom:24px}
.summary strong{color:#111827}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #E5E7EB;text-align:center;font-size:11px;color:#9CA3AF}
@media print{body{padding:20px}@page{margin:1.5cm}}
</style></head><body>
<div class="header">
  <div class="logo">Talisman</div>
  <div class="meta">${t('nav.reports')}<br>${periodLabel} — ${today}</div>
</div>

<div class="stats">
  <div class="stat"><div class="stat-value">${revenue.toLocaleString()}</div><div class="stat-label">${t('label.revenue')} (${cur})</div></div>
  <div class="stat expense"><div class="stat-value">${expenses.toLocaleString()}</div><div class="stat-label">${t('label.expenses')} (${cur})</div></div>
  <div class="stat ${profit >= 0 ? 'profit-pos' : 'profit-neg'}"><div class="stat-value">${profit.toLocaleString()}</div><div class="stat-label">${t('label.profit')} (${cur})</div></div>
</div>

<div class="summary">
  <span>${t('label.avg_daily')}: <strong>${avgDaily.toLocaleString()} ${cur}</strong></span>
  ${revenue > 0 ? `<span>${t('label.profit_margin')}: <strong>${margin}%</strong></span>` : ''}
  ${revenueDelta !== 0 ? `<span>${t('label.vs_prior')}: <strong>${revenueDelta > 0 ? '+' : ''}${revenueDelta}%</strong></span>` : ''}
</div>

${dailyData.length > 0 ? `<div class="section"><h2>${revenueLabel}</h2>
<table><thead><tr><th>${t('label.date')}</th><th style="text-align:right">${t('label.revenue')}</th><th style="text-align:right">${t('label.expenses')}</th></tr></thead>
<tbody>${dailyRows}</tbody></table></div>` : ''}

${topProducts.length > 0 ? `<div class="section"><h2>${t('label.top_products')}</h2>
<table><thead><tr><th>${t('label.product')}</th><th style="text-align:right">${t('label.revenue')}</th></tr></thead>
<tbody>${topRows}</tbody></table></div>` : ''}

<div class="footer">Talisman — ${t('app.tagline')}</div>
</body></html>`;

    // Use a hidden iframe instead of window.open to avoid layout corruption
    // and popup blocker issues
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) { document.body.removeChild(iframe); return; }
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for content to render, then print and clean up
    setTimeout(() => {
      iframe.contentWindow?.print();
      // Remove iframe after print dialog closes
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 300);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <Toast msg={toast} />

      {/* Period pills */}
      <div className="flex gap-2">
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button key={p} type="button" onClick={() => { setPeriod(p); setEmpFilter('all'); }}
            className={`flex-1 h-11 rounded-full text-sm font-heading font-bold transition-all ${
              period === p
                ? 'gradient-primary text-white shadow-md'
                : 'bg-[var(--c-card)] text-[var(--c-text2)] border border-[var(--c-border)]'
            }`}>
            {t(`period.${p}`)}
          </button>
        ))}
      </div>

      {/* Employee filter */}
      {uniqueEmployees.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button type="button" onClick={() => setEmpFilter('all')}
            className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              empFilter === 'all' ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-secondary border border-gray-200'
            }`}>
            {t('history.all')}
          </button>
          <button type="button" onClick={() => setEmpFilter('owner')}
            className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              empFilter === 'owner' ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-secondary border border-gray-200'
            }`}>
            👑 {t('employees.role_owner')}
          </button>
          {uniqueEmployees.map((emp) => (
            <button key={emp.id} type="button" onClick={() => setEmpFilter(emp.id)}
              className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
                empFilter === emp.id ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-secondary border border-gray-200'
              }`}>
              👤 {emp.name}
            </button>
          ))}
        </div>
      )}

      {/* Employee Performance Report link (owner only) */}
      {currentEmployee?.role === 'owner' && (
        <button type="button" onClick={() => navigate('/reports/performance')}
          className="w-full bg-[var(--c-card)] rounded-2xl p-4 shadow-sm flex items-center gap-3 active:scale-[0.99] transition-transform border border-[var(--c-border)]">
          <span className="text-2xl">👥</span>
          <div className="flex-1 text-left">
            <p className="text-[14px] font-bold text-primary">{t('performance.title')}</p>
            <p className="text-[12px] text-secondary">{t('performance.subtitle')}</p>
          </div>
          <span className="text-muted text-lg">›</span>
        </button>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : (
        <>
          {/* ── Two-column on tablet+: stats left, charts right ── */}
          <div className="md:grid md:grid-cols-5 md:gap-4 lg:flex lg:flex-col md:items-start">

          {/* Left: stats (2/5 on tablet, full-width on desktop) */}
          <div className="md:col-span-2 lg:w-full space-y-3 lg:mb-1">
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-3 md:grid-cols-1 lg:grid-cols-4 gap-3">
            <BigStatCard label={t('label.revenue')} value={revenue} bg="bg-emerald-50" color="text-emerald-700" t={t} />
            <BigStatCard label={t('label.expenses')} value={expenses} bg="bg-orange-50" color="text-[var(--c-secondary)]" t={t} />
            <BigStatCard label={t('expenses.true_profit')} value={profit} bg={profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'} color={profit >= 0 ? 'text-emerald-700' : 'text-[var(--c-tertiary)]'} t={t} />
          </div>

          {/* ── Expense breakdown ── */}
          {(operatingExpenses > 0 || cogs > 0) && (
            <div className="card p-4 space-y-3">
              <p className="text-[13px] font-bold text-[var(--c-text)] uppercase tracking-wider">{t('expenses.true_profit_desc')}</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-[var(--c-text2)]">{t('label.revenue')}</span><span className="font-bold text-emerald-700">+{revenue.toLocaleString()} G</span></div>
                {cogs > 0 && <div className="flex justify-between"><span className="text-[var(--c-text2)]">{t('expenses.cogs') || 'COGS'}</span><span className="font-bold text-[var(--c-secondary)]">-{cogs.toLocaleString()} G</span></div>}
                {expenseBreakdown.map(({ cat, emoji, total }) => (
                  <div key={cat} className="flex justify-between items-center">
                    <span className="text-[var(--c-text2)]">{emoji} {t(`expenses.cat_${cat}`)}</span>
                    <span className="font-bold text-[#E76F51]">-{total.toLocaleString()} G</span>
                  </div>
                ))}
                <div className="h-px bg-[var(--c-border)] my-1" />
                <div className="flex justify-between font-heading font-extrabold text-base">
                  <span>{t('expenses.true_profit')}</span>
                  <span className={profit >= 0 ? 'text-emerald-700' : 'text-[#E76F51]'}>{profit.toLocaleString()} G</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Comparison banner ── */}
          {hasData && (
            <div className="card p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DeltaBadge delta={revenueDelta} t={t} />
                  <span className="text-xs text-[var(--c-text2)]">{t('label.vs_prior')}</span>
                </div>
                <div className="flex flex-col md:flex-col gap-1 text-sm">
                  <span className="text-[var(--c-text2)]">
                    {t('label.avg_daily')}: <strong className="text-[var(--c-text)]">{avgDaily.toLocaleString()} {t('label.currency')}</strong>
                  </span>
                  {revenue > 0 && (
                    <span className="text-[var(--c-text2)]">
                      {t('label.profit_margin')}: <strong className={profit >= 0 ? 'text-emerald-700' : 'text-[var(--c-tertiary)]'}>{margin}%</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Share + Print buttons (inside left column on tablet) */}
          <div className="hidden md:flex md:gap-2">
            <button type="button" onClick={handleShare} disabled={!hasData}
              className={`btn flex-1 h-[48px] rounded-xl font-heading font-bold text-sm gap-2 transition-colors ${
                !hasData
                  ? 'border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                  : 'border-2 border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white'
              }`}>
              <RiShareForwardFill className="h-5 w-5" />
              {t('action.share_report')}
            </button>
            <button type="button" onClick={handlePrint} disabled={!hasData}
              className={`btn h-[48px] px-4 rounded-xl font-heading font-bold text-sm gap-2 transition-colors ${
                !hasData
                  ? 'border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                  : 'border-2 border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white'
              }`}>
              <RiPrinterLine className="h-5 w-5" />
              PDF
            </button>
          </div>
          </div>

          {/* Right: charts + top products (3/5 on tablet) */}
          <div className="md:col-span-3 lg:w-full space-y-4 mt-4 md:mt-0">

          {/* ── Revenue chart with trend ── */}
          {dailyData.length > 1 ? (
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-lg text-[var(--c-text)]">{revenueLabel}</h3>
                <span className="text-xs text-[var(--c-muted)] select-none">{t('label.trend')}</span>
              </div>
              <div className="h-[200px] lg:h-[350px]"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text2)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text2)' }} width={45} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [
                      `${Number(v).toLocaleString()} ${t('label.currency')}`,
                      name === 'revenue' ? t('label.revenue') : t('label.expenses'),
                    ]}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontFamily: 'var(--font-body)' }}
                  />
                  <Bar dataKey="revenue" fill="var(--c-primary)" radius={[6, 6, 0, 0]} animationDuration={500} />
                  {dailyData.some((d) => d.expenses > 0) && (
                    <Bar dataKey="expenses" fill="var(--c-secondary)" radius={[6, 6, 0, 0]} opacity={0.6} animationDuration={500} />
                  )}
                  {avgDaily > 0 && (
                    <ReferenceLine y={avgDaily} stroke="var(--c-primary)" strokeDasharray="6 4" strokeWidth={1.5} opacity={0.5} />
                  )}
                </BarChart>
              </ResponsiveContainer></div>
            </div>
          ) : dailyData.length === 1 ? (
            // Single day — show as a big number instead of a lone bar
            <div className="card p-6 text-center">
              <p className="text-xs text-[var(--c-text2)] uppercase tracking-wide mb-1">{revenueLabel}</p>
              <p className="font-heading text-4xl font-extrabold text-[var(--c-primary)]">
                {dailyData[0].revenue.toLocaleString()} {t('label.currency')}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-10 text-center space-y-3" style={{ minHeight: 250 }}>
              <RiBarChart2Fill className="h-12 w-12 text-[#9CA3AF] mx-auto" />
              <p className="text-[var(--c-text2)] text-sm leading-relaxed max-w-[260px] mx-auto">{t('reports.chart_empty')}</p>
            </div>
          )}

          {/* ── Cumulative trend (week/month only) ── */}
          {trendData.length > 2 && period !== 'today' && (
            <div className="card p-4 space-y-2">
              <h3 className="font-heading font-bold text-lg text-[var(--c-text)]">{t('label.trend')}</h3>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--c-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--c-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--c-text2)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: unknown) => [`${Number(v).toLocaleString()} ${t('label.currency')}`, t('label.revenue')]}
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontFamily: 'var(--font-body)' }}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="var(--c-primary)" strokeWidth={2.5} fill="url(#trendGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Top products with revenue bars ── */}
          {topProducts.length > 0 && (
            <section>
              <h3 className="font-heading text-lg font-bold mb-2">{t('label.top_products')}</h3>
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="card px-4 py-3 flex items-center gap-3 animate-card-appear" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${RANK_COLORS[i] ?? 'bg-gray-200'}`}>
                      {p.emoji || (i + 1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        <span className="font-heading font-bold text-sm text-[var(--c-primary)] ml-2 whitespace-nowrap">
                          {p.revenue.toLocaleString()} {t('label.currency')}
                        </span>
                      </div>
                      {/* Revenue proportion bar */}
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--c-primary)] transition-all duration-500"
                          style={{ width: `${(p.revenue / maxProductRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Payment method breakdown ── */}
          {paymentBreakdown && hasData && (
            <section>
              <h3 className="font-heading text-lg font-bold mb-2">{t('payment.by_method')}</h3>
              <div className="card p-4 space-y-3">
                {paymentBreakdown.map((pm) => (
                  <div key={pm.label} className="flex items-center gap-3">
                    <span className="text-xl flex-shrink-0">{pm.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--c-text)]">{pm.label}</span>
                        <span className="text-sm font-bold text-[var(--c-text)]">{pm.amount.toLocaleString()} {t('label.currency')} ({pm.pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full ${pm.color} transition-all duration-500`} style={{ width: `${pm.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sales by Employee */}
          {employeeSales.length > 1 && hasData && (
            <section>
              <h3 className="font-heading text-lg font-bold mb-2">👥 {t('reports.sales_by_employee')}</h3>
              <div className="card p-4 space-y-3">
                {employeeSales.map((emp, i) => (
                  <div key={emp.name + i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-bold text-muted w-5">#{i + 1}</span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                        emp.isOwner ? 'gradient-primary' : 'bg-amber-100'
                      }`}>
                        {emp.isOwner ? '👑' : '👤'}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-primary">{emp.name}</p>
                        <p className="text-[12px] text-secondary">{emp.count} {t('reports.transactions')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-bold text-primary">{emp.total.toLocaleString()} {t('label.currency')}</p>
                      <p className="text-[11px] text-muted">{(emp as any).pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          </div>{/* end right column */}
          </div>{/* end two-column grid */}

          {/* Share + Print (phone only) */}
          <div className="md:hidden space-y-2">
            <div className="flex gap-2">
              <button type="button" onClick={handleShare} disabled={!hasData}
                className={`btn flex-1 h-[52px] rounded-xl font-heading font-bold text-base gap-2 transition-colors ${
                  !hasData
                    ? 'border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                    : 'border-2 border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white'
                }`}>
                <RiShareForwardFill className="h-5 w-5" />
                {t('action.share_report')}
              </button>
              <button type="button" onClick={handlePrint} disabled={!hasData}
                className={`btn h-[52px] px-5 rounded-xl font-heading font-bold text-base gap-2 transition-colors ${
                  !hasData
                    ? 'border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                    : 'border-2 border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white'
                }`}>
                <RiPrinterLine className="h-5 w-5" />
                PDF
              </button>
            </div>
            {!hasData && (
              <p className="text-xs text-[var(--c-text2)] text-center">{t('reports.share_hint')}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BigStatCard({ label, value, bg, color, t }: {
  label: string; value: number; bg: string; color: string; t: (k: string) => string;
}) {
  const animated = useCountUp(value);
  return (
    <div className={`${bg} rounded-2xl p-3.5 text-center animate-card-appear`}>
      <p className={`font-heading text-xl font-extrabold ${color}`}>{animated.toLocaleString()}</p>
      <p className="text-[11px] text-[var(--c-text2)] mt-0.5">{label}</p>
      <p className="text-[10px] text-[var(--c-text2)]">{t('label.currency')}</p>
    </div>
  );
}

function DeltaBadge({ delta, t }: { delta: number; t: (k: string) => string }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
        <RiSubtractLine className="h-3.5 w-3.5" />
        {t('label.same')}
      </span>
    );
  }

  const positive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
      positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-[var(--c-tertiary)]'
    }`}>
      {positive ? <RiArrowUpLine className="h-3.5 w-3.5" /> : <RiArrowDownLine className="h-3.5 w-3.5" />}
      {positive ? '+' : ''}{delta}% — {positive ? t('label.better') : t('label.worse')}
    </span>
  );
}

function sumByType(txns: TransactionRecord[], type: string): number {
  return txns.filter((t) => t.transaction_type === type).reduce((s, t) => s + Number(t.total_amount), 0);
}
