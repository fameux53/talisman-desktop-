import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RiShoppingCart2Fill,
  RiHandCoinFill,
  RiAddBoxFill,
  RiArrowRightLine,
  RiAlertFill,
  RiMoneyDollarCircleLine,
  RiShoppingBag3Line,
  RiHandCoinLine,
  RiShoppingCart2Line,
  RiCloseLine,
  RiCheckboxCircleFill,
  RiCheckboxBlankCircleLine,
} from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useProducts } from '../hooks/useProducts';
import { useTodaySales } from '../hooks/useTodaySales';
import api from '../services/api';
import { getAllFromStore, type CreditRecord } from '../services/db';
import { useCountUp } from '../hooks/useCountUp';
import { formatDate } from '../utils/dateFormat';
import { formatCurrency, formatCurrencyParts } from '../utils/currency';
import InstallBanner from '../components/InstallBanner';

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function HomePage() {
  const { t, locale } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);
  const { products } = useProducts();
  const { sales } = useTodaySales();

  const todayRevenue = useMemo(
    () => sales.reduce((s, tx) => s + Number(tx.total_amount), 0),
    [sales],
  );

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock_quantity < p.low_stock_threshold),
    [products],
  );

  const recent = useMemo(() => sales.slice(0, 5), [sales]);

  // Fetch outstanding credit
  const [outstanding, setOutstanding] = useState(0);
  const fetchOutstanding = useCallback(async () => {
    try {
      if (navigator.onLine) {
        const { data } = await api.get<{ total_outstanding: number }>('/credit/summary');
        setOutstanding(Number(data.total_outstanding));
      } else {
        const entries = await getAllFromStore('creditEntries');
        const total = entries.reduce((sum: number, e: CreditRecord) =>
          e.entry_type === 'CREDIT_GIVEN' ? sum + e.amount : sum - e.amount, 0);
        setOutstanding(Math.max(0, total));
      }
    } catch {
      const entries = await getAllFromStore('creditEntries');
      const total = entries.reduce((sum: number, e: CreditRecord) =>
        e.entry_type === 'CREDIT_GIVEN' ? sum + e.amount : sum - e.amount, 0);
      setOutstanding(Math.max(0, total));
    }
  }, []);

  useEffect(() => { fetchOutstanding(); }, [fetchOutstanding]);

  // Checklist state
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem('mm_checklist_done') === '1',
  );
  const [hasCredits, setHasCredits] = useState(false);
  const voiceUsed = localStorage.getItem('mm_voice_used') === '1';

  useEffect(() => {
    getAllFromStore('creditEntries').then((entries) => setHasCredits(entries.length > 0));
  }, []);

  const checklistSteps = [
    { key: 'step1', done: products.length > 0, to: '/inventory' },
    { key: 'step2', done: sales.length > 0, to: '/sales' },
    { key: 'step3', done: hasCredits, to: '/credit' },
    { key: 'step4', done: voiceUsed, to: '/sales' },
  ];
  const checklistComplete = checklistSteps.every((s) => s.done);
  const showChecklist = !checklistDismissed && !checklistComplete;

  const dismissChecklist = () => {
    localStorage.setItem('mm_checklist_done', '1');
    setChecklistDismissed(true);
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* ── Hero greeting ── */}
      <section className="gradient-primary px-5 pt-6 pb-8 text-white lg:rounded-t-2xl">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-heading text-2xl font-extrabold">
            {t('label.greeting')}, {vendor?.display_name ?? t('label.customer')}! 👋
          </h1>
          <p className="text-white/70 text-sm mt-1">{formatDate(new Date(), locale)}</p>
        </div>
      </section>

      <InstallBanner />

      <div className="px-4 max-w-2xl mx-auto space-y-5 py-1">
        {/* ── Quick actions ── */}
        <section>
          <div className="flex gap-4 overflow-x-auto py-1 -mx-1 px-1 scrollbar-hide md:justify-center">
            <QuickAction to="/sales" icon={<RiShoppingCart2Fill className="h-7 w-7" />} label={t('action.new_sale')} bg="gradient-primary" />
            <QuickAction to="/credit" icon={<RiHandCoinFill className="h-7 w-7" />} label={t('action.new_credit')} bg="gradient-secondary" />
            <QuickAction to="/inventory" icon={<RiAddBoxFill className="h-7 w-7" />} label={t('action.add_product')} bg="bg-[#0D9488]" />
          </div>
        </section>

        {/* ── Checklist or Daily Tip ── */}
        {showChecklist ? (
          <section className="card p-5 border-l-4 border-l-[#2D6A4F]">
            <h3 className="font-heading font-bold text-base text-[var(--c-text)]">{t('checklist.title')}</h3>
            <p className="text-xs text-[var(--c-text2)] mb-3">{t('checklist.subtitle')}</p>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-gray-100 mb-3 overflow-hidden">
              <div className="h-full bg-[#2D6A4F] rounded-full transition-all duration-500" style={{ width: `${(checklistSteps.filter((s) => s.done).length / checklistSteps.length) * 100}%` }} />
            </div>
            <div className="space-y-2.5">
              {checklistSteps.map((step, i) => (
                <Link key={step.key} to={step.to} className="flex items-center gap-3 group">
                  {step.done ? (
                    <RiCheckboxCircleFill className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <RiCheckboxBlankCircleLine className="h-5 w-5 text-gray-300 group-hover:text-[var(--c-primary)] flex-shrink-0 transition-colors" />
                  )}
                  <span className={`text-sm ${step.done ? 'text-gray-400 line-through' : 'text-[var(--c-text)] group-hover:text-[var(--c-primary)]'} transition-colors`}>
                    {t(`checklist.${step.key}`)}
                  </span>
                </Link>
              ))}
            </div>
            {checklistComplete && (
              <div className="mt-3 text-center">
                <p className="text-sm font-medium text-emerald-600 mb-2">{t('checklist.done')}</p>
                <button type="button" onClick={dismissChecklist} className="text-xs text-[var(--c-text2)] underline">{t('onboarding.dismiss')}</button>
              </div>
            )}
          </section>
        ) : !checklistDismissed ? null : (
          <DailyTip t={t} />
        )}

        {/* ── Stats ── */}
        <div className="space-y-5">
          <section className="grid grid-cols-3 gap-3">
              <StatCard
                label={t('label.revenue')}
                parts={formatCurrencyParts(todayRevenue, locale)}
                value={todayRevenue}
                icon={<RiMoneyDollarCircleLine className="h-5 w-5" />}
                iconBg="bg-emerald-100"
                iconColor="text-[#2D6A4F]"
                valueColor="text-[#2D6A4F]"
                borderColor="border-l-[#2D6A4F]"
              />
              <StatCard
                label={t('label.sales_count')}
                parts={{ number: String(sales.length), suffix: '' }}
                value={sales.length}
                icon={<RiShoppingBag3Line className="h-5 w-5" />}
                iconBg="bg-emerald-100"
                iconColor="text-[#2D6A4F]"
                valueColor="text-[#2D6A4F]"
                borderColor="border-l-[#40916C]"
              />
              <StatCard
                label={t('label.outstanding')}
                parts={formatCurrencyParts(outstanding, locale)}
                value={outstanding}
                icon={<RiHandCoinLine className="h-5 w-5" />}
                iconBg="bg-orange-100"
                iconColor="text-[#F4A261]"
                valueColor={outstanding > 0 ? 'text-[#E76F51]' : 'text-[#F4A261]'}
                borderColor="border-l-[#F4A261]"
              />
            </section>

          {/* Low stock alerts */}
          {lowStockProducts.length > 0 && (
            <section className="bg-[#FFF8E7] border border-[#FFD166]/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <RiAlertFill className="h-5 w-5 text-[#F4A261]" />
                <h3 className="font-heading font-bold text-[var(--c-text)]">
                  {t('label.low_stock_alert')}
                </h3>
              </div>
              <div className="space-y-1.5">
                {lowStockProducts.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[#E76F51] font-bold">{p.stock_quantity} {p.unit}</span>
                  </div>
                ))}
              </div>
              <Link to="/inventory" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--c-primary)]">
                {t('action.go_inventory')} <RiArrowRightLine className="h-4 w-4" />
              </Link>
            </section>
          )}

          {/* Recent activity */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-heading text-lg font-bold text-[var(--c-text)]">
                {t('label.recent_activity')}
              </h2>
              <Link to="/sales" className="text-sm font-medium text-[var(--c-primary)] flex items-center gap-0.5">
                {t('action.see_all')} <RiArrowRightLine className="h-4 w-4" />
              </Link>
            </div>

            {recent.length === 0 ? (
              <div className="card p-8 text-center space-y-4">
                <p className="text-5xl">🛒</p>
                <p className="text-[var(--c-text2)] text-base">{t('label.no_sales_today')}</p>
                <Link
                  to="/sales"
                  className="btn mx-auto h-12 px-6 rounded-xl border-2 border-[var(--c-primary)] text-[var(--c-primary)] font-heading font-bold text-base hover:bg-[var(--c-primary)] hover:text-white transition-colors gap-2"
                >
                  <RiShoppingCart2Line className="h-5 w-5" />
                  {t('message.no_sales_cta')}
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((tx, i) => {
                  const product = products.find((p) => p.id === tx.product_id);
                  return (
                    <div key={tx.id} className="card px-4 py-3 flex items-center justify-between animate-card-appear" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                          tx.transaction_type === 'SALE' ? 'bg-emerald-500' :
                          tx.transaction_type === 'PURCHASE' ? 'bg-blue-500' :
                          'bg-[#F4A261]'
                        }`} />
                        <span className="text-base font-medium truncate">{product?.name ?? '—'}</span>
                      </div>
                      <span className="font-heading font-bold text-[var(--c-primary)] ml-2 whitespace-nowrap">
                        {formatCurrency(Number(tx.total_amount), locale)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function QuickAction({ to, icon, label, bg }: {
  to: string; icon: React.ReactNode; label: string; bg: string;
}) {
  return (
    <Link
      to={to}
      className={`${bg} text-white rounded-2xl p-4 min-w-[140px] flex flex-col gap-2 shadow-md active:scale-95 transition-transform`}
    >
      {icon}
      <span className="font-heading font-bold text-sm leading-tight">{label}</span>
    </Link>
  );
}

function DailyTip({ t }: { t: (k: string) => string }) {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tipIndex = dayOfYear % 5;
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <section className="bg-[#F0F9FF] rounded-2xl p-4 flex gap-3 items-start animate-fade-up">
      <span className="text-xl flex-shrink-0">💡</span>
      <p className="text-[13px] text-[#1E40AF] leading-snug flex-1">{t(`tip.daily.${tipIndex}`)}</p>
      <button type="button" onClick={() => setDismissed(true)} className="p-1 flex-shrink-0 -mt-1 -mr-1">
        <RiCloseLine className="h-4 w-4 text-[#1E40AF]/40" />
      </button>
    </section>
  );
}

function StatCard({ label, parts, value, icon, iconBg, iconColor, valueColor, borderColor }: {
  label: string;
  parts: { number: string; suffix: string };
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  valueColor: string;
  borderColor: string;
}) {
  useCountUp(value);

  return (
    <div className={`card p-3.5 border-l-4 ${borderColor} animate-card-appear`}>
      <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${iconBg} ${iconColor} mb-2`}>
        {icon}
      </div>
      <p className={`font-heading leading-none ${valueColor}`}>
        <span className="text-[22px] font-bold">{parts.number}</span>
        {parts.suffix && <span className="text-[14px] font-normal opacity-60 ml-1">{parts.suffix}</span>}
      </p>
      <p className="text-[13px] text-[var(--c-text2)] mt-1.5 leading-tight">{label}</p>
    </div>
  );
}
