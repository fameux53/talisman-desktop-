import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Area, AreaChart, ReferenceLine,
} from 'recharts';
import {
  RiShareForwardFill, RiArrowUpLine, RiArrowDownLine, RiSubtractLine, RiBarChart2Fill,
} from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useProducts } from '../hooks/useProducts';
import { useCountUp } from '../hooks/useCountUp';
import Toast from '../components/Toast';
import api from '../services/api';
import { getAllFromStore, type TransactionRecord } from '../services/db';

type Period = 'today' | 'week' | 'month';

function startOf(period: Period, offset = 0): string {
  const d = new Date();
  if (period === 'today') {
    d.setDate(d.getDate() - offset);
  } else if (period === 'week') {
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - offset * 7);
  } else {
    d.setMonth(d.getMonth() - offset, 1);
  }
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
}

export default function ReportsPage() {
  const { t } = useI18n();
  const { products } = useProducts();
  const [period, setPeriod] = useState<Period>('week');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [priorTransactions, setPriorTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const dateFrom = useMemo(() => startOf(period), [period]);
  const dateTo = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const priorFrom = useMemo(() => startOf(period, 1), [period]);
  const priorTo = useMemo(() => {
    const d = new Date(dateFrom);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
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
        setTransactions(cur.data);
        setPriorTransactions(prior.data);
      } else {
        const all = await getAllFromStore('transactions');
        setTransactions(all);
        setPriorTransactions([]);
      }
    } catch {
      setTransactions(await getAllFromStore('transactions'));
      setPriorTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, priorFrom, priorTo]);

  useEffect(() => { refresh(); }, [refresh]);

  // --- Stats ---
  const revenue = useMemo(() => sumByType(transactions, 'SALE'), [transactions]);
  const expenses = useMemo(() => sumByType(transactions, 'PURCHASE'), [transactions]);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const priorRevenue = useMemo(() => sumByType(priorTransactions, 'SALE'), [priorTransactions]);
  const revenueDelta = priorRevenue > 0 ? Math.round(((revenue - priorRevenue) / priorRevenue) * 100) : 0;

  const numDays = daysBetween(dateFrom, dateTo);
  const avgDaily = numDays > 0 ? Math.round(revenue / numDays) : 0;

  // --- Chart data ---
  const dailyData = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    for (const tx of transactions) {
      const d = (tx as TransactionRecord & { created_at?: string }).created_at?.slice(0, 10) ?? dateTo;
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
  }, [transactions, dateTo]);

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
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.transaction_type !== 'SALE' || !tx.product_id) continue;
      const name = products.find((p) => p.id === tx.product_id)?.name ?? tx.product_id;
      map.set(name, (map.get(name) ?? 0) + Number(tx.total_amount));
    }
    return Array.from(map.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [transactions, products]);

  const maxProductRevenue = topProducts[0]?.revenue ?? 1;
  const RANK_COLORS = ['bg-[#FFD166]', 'bg-gray-300', 'bg-[#F4A261]'];

  const hasData = revenue > 0 || expenses > 0;

  // --- Share ---
  const handleShare = () => {
    const today = new Date().toLocaleDateString('fr-HT', { day: 'numeric', month: 'short', year: 'numeric' });
    const cur = t('label.currency');
    const topList = topProducts.slice(0, 3).map((p) => `${p.name} (${p.revenue.toLocaleString()} ${cur})`).join(', ');
    const text = [
      `\u{1F4CA} MarketMama Rap\u00f2 \u2014 ${today}`,
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

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 space-y-5 animate-fade-up">
      <Toast msg={toast} />

      {/* Period pills */}
      <div className="flex gap-2">
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <button key={p} type="button" onClick={() => setPeriod(p)}
            className={`flex-1 h-11 rounded-full text-sm font-heading font-bold transition-all ${
              period === p
                ? 'gradient-primary text-white shadow-md'
                : 'bg-[var(--c-card)] text-[var(--c-text2)] border border-[var(--c-border)]'
            }`}>
            {t(`period.${p}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : (
        <>
          {/* ── Stat cards ── */}
          <div className="grid grid-cols-3 gap-3">
            <BigStatCard label={t('label.revenue')} value={revenue} bg="bg-emerald-50" color="text-emerald-700" t={t} />
            <BigStatCard label={t('label.expenses')} value={expenses} bg="bg-orange-50" color="text-[var(--c-secondary)]" t={t} />
            <BigStatCard label={t('label.profit')} value={profit} bg={profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'} color={profit >= 0 ? 'text-emerald-700' : 'text-[var(--c-tertiary)]'} t={t} />
          </div>

          {/* ── Comparison banner ── */}
          {hasData && (
            <div className="card p-4 flex items-center justify-between">
              <div className="space-y-1">
                {/* Delta badge */}
                <div className="flex items-center gap-2">
                  <DeltaBadge delta={revenueDelta} t={t} />
                  <span className="text-xs text-[var(--c-text2)]">{t('label.vs_prior')}</span>
                </div>
                {/* Secondary stats */}
                <div className="flex items-center gap-4 text-sm">
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

          {/* ── Revenue chart with trend ── */}
          {dailyData.length > 1 ? (
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-lg text-[var(--c-text)]">{t('label.daily_revenue')}</h3>
                <span className="text-xs text-[var(--c-text2)]">{t('label.trend')} →</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--c-text2)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--c-text2)' }} width={45} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${v.toLocaleString()} ${t('label.currency')}`,
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
              </ResponsiveContainer>
            </div>
          ) : dailyData.length === 1 ? (
            // Single day — show as a big number instead of a lone bar
            <div className="card p-6 text-center">
              <p className="text-xs text-[var(--c-text2)] uppercase tracking-wide mb-1">{t('label.daily_revenue')}</p>
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
                    formatter={(v: number) => [`${v.toLocaleString()} ${t('label.currency')}`, t('label.revenue')]}
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
                      {i + 1}
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

          {/* Share */}
          <div className="space-y-1.5">
            <button type="button" onClick={handleShare} disabled={!hasData}
              className={`btn w-full h-[52px] rounded-xl font-heading font-bold text-base gap-2 transition-colors ${
                !hasData
                  ? 'border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                  : 'border-2 border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white active:bg-[var(--c-primary)] active:text-white'
              }`}>
              <RiShareForwardFill className="h-5 w-5" />
              {t('action.share_report')}
            </button>
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
