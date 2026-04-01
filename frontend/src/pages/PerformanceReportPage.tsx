import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiShareForwardFill, RiArrowLeftLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { dataLayer } from '../services/dataLayer';
import { generatePerformanceReport } from '../services/performanceReport';
import { formatCurrency } from '../utils/currency';
import type { PerformanceReportRecord } from '../services/db';

export default function PerformanceReportPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const vendor = useAuthStore((s) => s.vendor);
  const vendorId = vendor?.id ?? '';

  const [reports, setReports] = useState<PerformanceReportRecord[]>([]);
  const [selected, setSelected] = useState<PerformanceReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    const all = await dataLayer.getPerformanceReports(vendorId);
    setReports(all);
    if (all.length > 0) {
      const latest = all[0];
      setSelected(latest);
      if (!latest.is_read) {
        await dataLayer.savePerformanceReport({ ...latest, is_read: true });
      }
    }
    setLoading(false);
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const report = await generatePerformanceReport(vendorId);
      setReports((prev) => [report, ...prev]);
      setSelected(report);
    } catch (err) {
      console.error('[Talisman] Failed to generate performance report:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = () => {
    if (!selected) return;
    const cur = t('label.currency');
    const lines = [
      `📊 *${t('performance.title').toUpperCase()}*`,
      `📅 ${formatPeriod(selected.period_start)} — ${formatPeriod(selected.period_end)}`,
      '',
      `💰 ${t('performance.revenue')}: ${selected.summary.total_revenue.toLocaleString()} ${cur}`,
      `🛒 ${t('performance.transactions')}: ${selected.summary.total_transactions}`,
      '',
    ];
    [...selected.employees].sort((a, b) => a.comparison.revenue_rank - b.comparison.revenue_rank).forEach((emp) => {
      const rank = emp.comparison.revenue_rank === 1 ? '🥇' : emp.comparison.revenue_rank === 2 ? '🥈' : '🥉';
      const icon = emp.is_owner ? '👑' : '👤';
      const trend = emp.comparison.trend_vs_last_period >= 0
        ? `↑ +${emp.comparison.trend_vs_last_period}%`
        : `↓ ${emp.comparison.trend_vs_last_period}%`;
      lines.push(`${rank} ${icon} *${emp.name}*`);
      lines.push(`   ${t('performance.revenue')}: ${emp.metrics.revenue.toLocaleString()} ${cur}`);
      lines.push(`   ${t('performance.transactions')}: ${emp.metrics.transaction_count}`);
      lines.push(`   ${t('performance.avg_sale')}: ${emp.metrics.average_transaction_value.toLocaleString()} ${cur}`);
      lines.push(`   ${t('performance.days_worked')}: ${emp.metrics.days_worked}`);
      lines.push(`   ${trend}`);
      lines.push('');
    });
    lines.push('— Talisman 🛡️');
    const text = lines.join('\n');
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const report = selected;
  const employees = useMemo(() =>
    report ? [...report.employees].sort((a, b) => a.comparison.revenue_rank - b.comparison.revenue_rank) : [],
    [report],
  );
  const periodDays = useMemo(() => {
    if (!report) return 15;
    const s = new Date(report.period_start + 'T00:00:00');
    const e = new Date(report.period_end + 'T00:00:00');
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  }, [report]);
  const maxRevenue = useMemo(() => Math.max(...employees.map((e) => e.metrics.revenue), 1), [employees]);
  const totalRevenue = useMemo(() => employees.reduce((s, e) => s + e.metrics.revenue, 0), [employees]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-up max-w-2xl mx-auto">
        <div className="skeleton h-10 w-48 rounded-xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up max-w-2xl mx-auto pb-20 md:pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate('/reports')}
          className="h-9 w-9 rounded-full flex items-center justify-center text-secondary hover:bg-page">
          <RiArrowLeftLine className="h-5 w-5" />
        </button>
        <h1 className="font-heading text-xl font-bold text-primary">👥 {t('performance.title')}</h1>
      </div>

      {/* Period selector */}
      {reports.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {reports.map((r) => (
            <button key={r.id} type="button" onClick={() => setSelected(r)}
              className={`px-4 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap flex-shrink-0 transition-colors ${
                selected?.id === r.id ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-primary border border-gray-200'
              }`}>
              {formatPeriod(r.period_start)} — {formatPeriod(r.period_end)}
            </button>
          ))}
        </div>
      )}

      {!report ? (
        <div className="card p-10 text-center space-y-3">
          <p className="text-4xl">📊</p>
          <p className="text-secondary">{t('performance.no_data')}</p>
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="btn h-10 px-5 rounded-xl gradient-primary text-white font-heading font-bold text-sm mx-auto disabled:opacity-40">
            {generating ? t('label.loading') : t('performance.generate_now')}
          </button>
        </div>
      ) : (
        <>
          {/* Period summary */}
          <div className="card p-5">
            <h2 className="text-[14px] font-bold text-secondary uppercase tracking-wider mb-3">{t('performance.summary')}</h2>
            <div className="grid grid-cols-3 gap-3">
              <SummaryBox label={t('performance.revenue')} value={`${report.summary.total_revenue.toLocaleString()} ${t('label.currency')}`} />
              <SummaryBox label={t('performance.transactions')} value={String(report.summary.total_transactions)} />
              <SummaryBox label={t('performance.products_sold')} value={String(report.summary.total_products_sold)} />
            </div>
          </div>

          {/* Employee cards */}
          {employees.map((emp) => {
            const rankEmoji = emp.comparison.revenue_rank === 1 ? '🥇' : emp.comparison.revenue_rank === 2 ? '🥈' : emp.comparison.revenue_rank === 3 ? '🥉' : `#${emp.comparison.revenue_rank}`;
            const trendUp = emp.comparison.trend_vs_last_period >= 0;
            return (
              <div key={emp.employee_id ?? 'owner'} className="card p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <span className="text-xl">{rankEmoji}</span>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                    emp.is_owner ? 'gradient-primary' : emp.role === 'manager' ? 'bg-blue-100' : 'bg-amber-100'
                  }`}>
                    {emp.is_owner ? '👑' : '👤'}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-primary">{emp.name}</p>
                    <p className="text-[12px] text-secondary">
                      {emp.is_owner ? t('employees.role_owner') : t(`employees.role_${emp.role}`)}
                    </p>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricBox label={t('performance.revenue')} value={formatCurrency(emp.metrics.revenue, locale)} />
                  <MetricBox label={t('performance.transactions')} value={String(emp.metrics.transaction_count)} />
                  <MetricBox label={t('performance.avg_sale')} value={formatCurrency(emp.metrics.average_transaction_value, locale)} />
                  <MetricBox label={t('performance.largest_sale')} value={formatCurrency(emp.metrics.largest_sale, locale)} />
                  <MetricBox label={t('performance.days_worked')} value={`${emp.metrics.days_worked} / ${periodDays}`} />
                  <MetricBox label={t('performance.revenue_per_day')} value={formatCurrency(emp.metrics.revenue_per_day, locale)} />
                  <MetricBox label={t('performance.credit_given')} value={formatCurrency(emp.metrics.credit_given, locale)} />
                  <MetricBox label={t('performance.moncash')} value={formatCurrency(emp.metrics.moncash_collected, locale)} />
                </div>

                {/* Trend */}
                <div className={`p-3 rounded-xl ${trendUp ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className={`text-[13px] font-bold ${trendUp ? 'text-emerald-700' : 'text-red-600'}`}>
                    {trendUp ? '↑' : '↓'} {Math.abs(emp.comparison.trend_vs_last_period)}% {t('performance.vs_last_period')}
                    {emp.comparison.trend_vs_last_period >= 20 && ' 🔥'}
                  </p>
                </div>

                {/* Top products */}
                {emp.top_products.length > 0 && (
                  <div>
                    <p className="text-[12px] font-bold text-secondary uppercase tracking-wider mb-2">{t('performance.top_products')}</p>
                    <div className="space-y-1.5">
                      {emp.top_products.map((p, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[13px] text-primary">{p.emoji} {p.name}</span>
                          <span className="text-[13px] font-bold text-primary">{formatCurrency(p.revenue, locale)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Comparison chart */}
          {employees.length > 1 && (
            <div className="card p-5">
              <h3 className="text-[14px] font-bold text-primary mb-4">📊 {t('performance.comparison')}</h3>
              <div className="space-y-3">
                {employees.map((emp) => {
                  const pct = totalRevenue > 0 ? Math.round((emp.metrics.revenue / totalRevenue) * 100) : 0;
                  const barW = maxRevenue > 0 ? (emp.metrics.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={emp.employee_id ?? 'owner'}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[13px] font-semibold text-primary">
                          {emp.is_owner ? '👑' : '👤'} {emp.name}
                        </span>
                        <span className="text-[13px] font-bold text-primary">
                          {formatCurrency(emp.metrics.revenue, locale)} ({pct}%)
                        </span>
                      </div>
                      <div className="h-3 bg-page rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          emp.is_owner ? 'gradient-primary' : 'bg-[#40916C]'
                        }`} style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button type="button" onClick={handleShare}
              className="flex-1 btn h-12 rounded-xl border-2 border-[var(--c-primary)] text-[var(--c-primary)] font-heading font-bold text-sm gap-2 hover:bg-[var(--c-primary)] hover:text-white transition-colors">
              <RiShareForwardFill className="h-5 w-5" />
              {t('performance.share_whatsapp')}
            </button>
            <button type="button" onClick={handleGenerate} disabled={generating}
              className="btn h-12 px-5 rounded-xl gradient-primary text-white font-heading font-bold text-sm disabled:opacity-40">
              {generating ? '...' : t('performance.generate_now')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-page rounded-xl p-3 text-center">
      <p className="text-[11px] text-muted mb-0.5">{label}</p>
      <p className="text-[14px] font-bold text-primary">{value}</p>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-page rounded-xl p-3">
      <p className="text-[11px] text-muted mb-0.5">{label}</p>
      <p className="text-[15px] font-bold text-primary">{value}</p>
    </div>
  );
}

function formatPeriod(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-HT', { day: 'numeric', month: 'short' });
}
