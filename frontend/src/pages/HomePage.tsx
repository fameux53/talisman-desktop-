import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RiArrowRightLine, RiAlertFill, RiHandCoinLine,
  RiShoppingBag3Line, RiTimeLine, RiLineChartLine,
  RiArrowDownSLine, RiSmartphoneLine,
} from 'react-icons/ri';
import { useI18n, type Locale } from '../i18n';
import { BUSINESS_TIPS, type BusinessTip } from '../data/businessTips';
import { useAuthStore } from '../stores/authStore';
import { useProducts } from '../hooks/useProducts';
import { useProductMap } from '../hooks/useProductMap';
import { useTodaySales } from '../hooks/useTodaySales';
import api from '../services/api';
import { getVendorRecords, type CreditRecord, type SupplierRecord, type SupplierPriceRecord, type NoteRecord, type ExpenseRecord } from '../services/db';
import { formatDate } from '../utils/dateFormat';
import GoalProgress from '../components/GoalProgress';
import { formatCurrency } from '../utils/currency';
import QRDisplay from '../components/QRDisplay';
import { MiniInsights } from '../components/SmartInsights';
import { generateInsights, type Insight } from '../services/insightEngine';
import { type CalendarEvent } from '../services/db';

export default function HomePage() {
  const { t, locale } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);
  const { products } = useProducts();
  const { resolveProduct } = useProductMap();
  const { sales } = useTodaySales();

  const todayRevenue = useMemo(() => sales.reduce((s, tx) => s + Number(tx.total_amount), 0), [sales]);
  const todayMoncash = useMemo(() => sales.filter((tx) => (tx as any).payment_method === 'moncash').reduce((s, tx) => s + Number(tx.total_amount), 0), [sales]);
  const lowStockProducts = useMemo(() => products.filter((p) => p.low_stock_threshold > 0 && Number(p.stock_quantity) <= p.low_stock_threshold), [products]);
  const recent = useMemo(() => sales.slice(0, 5), [sales]);

  const vendorId = vendor?.id ?? '';

  const [outstanding, setOutstanding] = useState(0);
  const fetchOutstanding = useCallback(async () => {
    if (!vendorId) return;
    try {
      if (navigator.onLine) {
        const { data } = await api.get<{ total_outstanding: number }>('/credit/summary');
        setOutstanding(Number(data.total_outstanding));
      } else {
        const entries = await getVendorRecords('creditEntries', vendorId);
        setOutstanding(Math.max(0, entries.reduce((s: number, e: CreditRecord) => e.entry_type === 'CREDIT_GIVEN' ? s + e.amount : s - e.amount, 0)));
      }
    } catch {
      const entries = await getVendorRecords('creditEntries', vendorId);
      setOutstanding(Math.max(0, entries.reduce((s: number, e: CreditRecord) => e.entry_type === 'CREDIT_GIVEN' ? s + e.amount : s - e.amount, 0)));
    }
  }, [vendorId]);
  useEffect(() => { fetchOutstanding(); }, [fetchOutstanding]);

  // Mini insights for dashboard
  const [dashInsights, setDashInsights] = useState<Insight[]>([]);
  useEffect(() => {
    if (!vendorId) return;
    generateInsights(vendorId, locale, t).then(setDashInsights).catch(() => {});
  }, [vendorId, locale, t]);

  // Upcoming calendar events
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    if (!vendorId) return;
    getVendorRecords('calendarEvents', vendorId).then(events => {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = events
        .filter(e => e.date >= today && !e.is_completed)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3);
      setUpcomingEvents(upcoming);
    }).catch(() => {});
  }, [vendorId]);

  const [showPaymentQR, setShowPaymentQR] = useState(false);

  // Escape key closes payment QR modal
  useEffect(() => {
    if (!showPaymentQR) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowPaymentQR(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showPaymentQR]);

  // Supplier data for restock suggestions
  const [supplierData, setSupplierData] = useState<{ suppliers: SupplierRecord[]; prices: SupplierPriceRecord[] }>({ suppliers: [], prices: [] });
  useEffect(() => {
    if (!vendorId) return;
    Promise.all([getVendorRecords('suppliers', vendorId), getVendorRecords('supplierPrices' as any, vendorId)]).then(([s, p]) => setSupplierData({ suppliers: s as SupplierRecord[], prices: p as SupplierPriceRecord[] }));
  }, [vendorId]);

  return (
    <div className="animate-fade-up space-y-5">
      {/* ── Top section: Hero + Stats ── */}
      {/* Phone: stacked. Desktop: hero 2/3, stats 1/3 */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Hero Balance Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#40916C] rounded-3xl p-6 shadow-lg relative overflow-hidden h-[180px] lg:h-[220px] flex flex-col justify-between" data-tour="hero-card">
          <div className="absolute -top-10 -right-10 w-32 h-32 border-[20px] border-white/5 rounded-full pointer-events-none" />
          <div className="absolute top-10 right-10 w-16 h-16 border-[10px] border-white/5 rounded-full pointer-events-none" />
          <div className="relative z-10">
            <p className="text-white/80 text-[13px] font-medium mb-1">
              {t('label.revenue')} — {formatDate(new Date(), locale)}
            </p>
            <p className="text-[42px] font-display font-[800] text-white tracking-tight leading-none">
              {formatCurrency(todayRevenue, locale)}
            </p>
          </div>
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10 relative z-10">
            <div className="flex items-center gap-1.5">
              <RiShoppingBag3Line className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[14px] font-medium text-white/80">{sales.length} {t('label.sales_count').toLowerCase()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RiTimeLine className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[14px] font-medium text-white/80">
                {t('label.greeting')}, {vendor?.display_name ?? t('label.customer')}
              </span>
            </div>
          </div>
        </div>

        {/* Stats: horizontal scroll on phone, vertical stack on desktop */}
        <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 mt-5 md:mx-0 md:px-0 md:flex-wrap lg:mt-0 lg:flex-col lg:overflow-visible lg:pb-0 scrollbar-hide">
          <StatPill
            icon={<RiHandCoinLine className="h-[18px] w-[18px]" style={{ strokeWidth: 2.5 }} />}
            iconBg="bg-[#FFEDD5]"
            iconColor="text-[#F4A261]"
            label={t('label.outstanding')}
            value={formatCurrency(outstanding, locale)}
            valueColor="text-[#F4A261]"
          />
          <StatPill
            icon={<RiAlertFill className="h-[18px] w-[18px]" style={{ strokeWidth: 2.5 }} />}
            iconBg={lowStockProducts.length > 0 ? 'bg-[#FEE2E2]' : 'bg-[#D1FAE5]'}
            iconColor={lowStockProducts.length > 0 ? 'text-[#EF4444]' : 'text-[#2D6A4F]'}
            label={t('label.low_stock_alert')}
            value={String(lowStockProducts.length)}
            valueColor={lowStockProducts.length > 0 ? 'text-[#EF4444]' : 'text-[#2D6A4F]'}
          />
          <StatPill
            icon={<RiLineChartLine className="h-[18px] w-[18px]" style={{ strokeWidth: 2.5 }} />}
            iconBg="bg-[#D1FAE5]"
            iconColor="text-[#2D6A4F]"
            label={t('label.revenue')}
            value={formatCurrency(todayRevenue, locale)}
            valueColor="text-[#2D6A4F]"
          />
          <StatPill
            icon={<RiSmartphoneLine className="h-[18px] w-[18px]" style={{ strokeWidth: 2.5 }} />}
            iconBg="bg-[#FFF7ED]"
            iconColor="text-[#F4A261]"
            label={t('payment.today_moncash')}
            value={formatCurrency(todayMoncash, locale)}
            valueColor="text-[#F4A261]"
          />
          {/* QR Payment button */}
          <button
            type="button"
            onClick={() => {
              if (!vendor?.phone_number) {
                // no-op or could show toast — for now rely on the QR desc
              }
              setShowPaymentQR(true);
            }}
            className="bg-white rounded-2xl shadow-sm p-3 min-w-[150px] flex items-center gap-3 flex-shrink-0 active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-[#D1FAE5] text-[#2D6A4F]">
              <span className="text-[18px]">📱</span>
            </div>
            <div>
              <p className="text-[11px] font-medium text-[#6B7280] mb-0.5 whitespace-nowrap">QR Pèman</p>
              <p className="text-[13px] font-bold text-[#2D6A4F]">{t('qr.payment_qr')}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Payment QR Modal */}
      {showPaymentQR && (
        vendor?.phone_number ? (
          <QRDisplay
            data={`moncash://pay?phone=${vendor.phone_number}&name=${encodeURIComponent(vendor.display_name ?? 'Talisman')}`}
            title={t('qr.payment_qr')}
            subtitle={t('qr.payment_qr_desc')}
            vendorName={vendor.display_name}
            onClose={() => setShowPaymentQR(false)}
          />
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPaymentQR(false)} />
            <div className="relative bg-[var(--c-card)] rounded-3xl shadow-2xl max-w-[340px] w-full mx-4 p-6 text-center animate-fade-up">
              <p className="text-[15px] font-bold text-[var(--c-text)] mb-2">{t('qr.payment_qr')}</p>
              <p className="text-[13px] text-[var(--c-text2)]">{t('qr.no_phone')}</p>
              <button type="button" onClick={() => setShowPaymentQR(false)}
                className="mt-4 btn h-10 px-6 rounded-xl bg-[var(--c-primary)] text-white text-sm font-bold">
                OK
              </button>
            </div>
          </div>
        )
      )}

      {/* Goal Progress */}
      <GoalProgress vendorId={vendor?.id ?? ''} todayRevenue={todayRevenue} />

      {/* ── Smart Insights (mini) ── */}
      <MiniInsights insights={dashInsights} />

      {/* ── Upcoming Events widget ── */}
      {upcomingEvents.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[14px] font-bold text-[var(--c-text)] flex items-center gap-2">
              📅 {t('calendar.upcoming')}
            </h3>
            <Link to="/tools/calendar" className="text-[12px] font-bold text-[var(--c-primary)]">
              {t('calendar.view_all')} →
            </Link>
          </div>
          {upcomingEvents.map(event => {
            const emoji = event.type === 'market_day' ? '📍' : event.type === 'delivery' ? '📦' : event.type === 'credit_due' ? '💳' : event.type === 'expense_due' ? '🏠' : event.type === 'reminder' ? '🔔' : '📌';
            const eventDate = new Date(event.date + 'T12:00:00');
            const relDate = eventDate.toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, { weekday: 'short', day: 'numeric', month: 'short' });
            return (
              <div key={event.id} className="flex items-center gap-3 py-2">
                <span className="text-lg">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--c-text)] truncate">{event.title}</p>
                  <p className="text-[11px] text-[var(--c-muted)]">{relDate}{event.time ? ` • ${event.time}` : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Activity + Alerts ── */}
      {/* Tablet: 5-col (3+2). Desktop: 3-col (2+1) */}
      <div className="md:grid md:grid-cols-5 md:gap-4 lg:grid-cols-3 lg:gap-6 md:items-start">
        {/* Activity feed */}
        <div className="md:col-span-3 lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-[16px] font-bold text-[#111827]">{t('label.recent_activity')}</h2>
            <Link to="/history" className="text-[13px] font-bold text-[#2D6A4F] flex items-center gap-1">
              {t('action.see_all')} <RiArrowRightLine className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center text-center border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-[#D1FAE5] rounded-full flex items-center justify-center mb-3">
                <RiShoppingBag3Line className="h-8 w-8 text-[#2D6A4F] opacity-50" />
              </div>
              <p className="text-[15px] font-semibold text-[#111827] mb-1">{t('label.no_sales_today')}</p>
              <p className="text-[13px] text-[#9CA3AF] mb-3">{t('sales.first_cta')}</p>
              <RiArrowDownSLine className="h-6 w-6 text-[#2D6A4F] animate-bounce" />
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((tx, i) => {
                const product = resolveProduct(tx.product_id);
                let productLabel: string;
                if (product) {
                  productLabel = product.is_active === false ? `${product.name} ${t('reports.archived_suffix')}` : product.name;
                } else {
                  productLabel = tx.product_id ? t('reports.unknown_product') : '—';
                }
                const isSale = tx.transaction_type === 'SALE';
                return (
                  <div key={tx.id}
                    className={`bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-l-[3px] animate-card-appear ${
                      isSale ? 'border-l-[#2D6A4F]' : 'border-l-[#F4A261]'
                    }`}
                    style={{ animationDelay: `${i * 100 + 200}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-sm ${
                        isSale ? 'bg-gradient-to-br from-[#1B4332] to-[#40916C]' : 'bg-gradient-to-br from-[#E76F51] to-[#F4A261]'
                      }`}>
                        <RiShoppingBag3Line className="h-5 w-5" style={{ strokeWidth: 2.5 }} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-[#111827]">{productLabel}</p>
                        <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                          {tx.quantity} × {formatCurrency(Number(tx.unit_price), locale)}
                          {tx.employee_name && (
                            <span className="ml-1.5 text-[11px] text-[#6B7280]">• {t('employees.recorded_by').replace('{name}', tx.employee_name)}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[16px] font-bold ${isSale ? 'text-[#2D6A4F]' : 'text-[#EF4444]'}`}>
                      {isSale ? '+' : '-'}{formatCurrency(Number(tx.total_amount), locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side panel: alerts */}
        <div className="md:col-span-2 lg:col-span-1 space-y-4 mt-5 md:mt-0">
          {lowStockProducts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 border-l-[3px] border-l-[#F4A261]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                  <RiAlertFill className="h-[18px] w-[18px] text-[#F4A261]" />
                </div>
                <p className="font-bold text-[14px] text-[#111827]">{t('label.low_stock_alert')}</p>
              </div>
              {lowStockProducts.slice(0, 5).map((p) => (
                <p key={p.id} className="text-[13px] text-[#6B7280] ml-11">{p.name}: <span className="text-[#EF4444] font-medium">{p.stock_quantity} {p.unit}</span></p>
              ))}
              <Link to="/inventory" className="text-[13px] font-bold text-[#2D6A4F] ml-11 mt-2 inline-flex items-center gap-1">
                {t('action.go_inventory')} <RiArrowRightLine className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Restock suggestions */}
          {lowStockProducts.length > 0 && supplierData.prices.length > 0 && (
            <div className="card p-4 space-y-3">
              <p className="font-bold text-[14px] text-[var(--c-text)] flex items-center gap-2">
                🔄 {t('suppliers.restock')}
              </p>
              {lowStockProducts.slice(0, 3).map((p) => {
                const productPrices = supplierData.prices.filter((sp) => sp.productId === p.id);
                if (productPrices.length === 0) return null;
                const best = productPrices.reduce((a, b) => a.price < b.price ? a : b);
                const supplier = supplierData.suppliers.find((s) => s.id === best.supplierId);
                if (!supplier) return null;
                return (
                  <div key={p.id} className="bg-[var(--c-bg)] rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[var(--c-text)]">{p.name}</p>
                      <span className="text-xs text-[#EF4444] font-medium">{p.stock_quantity} {p.unit}</span>
                    </div>
                    <p className="text-xs text-[var(--c-text2)]">
                      {supplier.name} — {best.price.toLocaleString()} {t('label.currency')}/{best.unit}
                    </p>
                    {supplier.phone && (
                      <a href={`https://wa.me/${supplier.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-bold text-[#25D366] flex items-center gap-1">
                        📲 {t('suppliers.contact')}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Recurring expense reminders */}
          <RecurringExpenseReminder vendorId={vendor?.id ?? ''} t={t} locale={locale} />

          {/* Daily tip card */}
          <DailyTipCard locale={locale} t={t} />

          {/* Recent Notes widget */}
          <RecentNotesWidget vendorId={vendor?.id ?? ''} t={t} />
        </div>
      </div>
    </div>
  );
}

function DailyTipCard({ locale, t }: { locale: Locale; t: (k: string) => string }) {
  const [dismissed, setDismissed] = useState(false);
  const [manualOffset, setManualOffset] = useState(0);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tipIndex = (dayOfYear + manualOffset) % BUSINESS_TIPS.length;
  const tip = BUSINESS_TIPS[tipIndex];

  const title = locale === 'fr' ? tip.titleFR : locale === 'en' ? tip.titleEN : tip.titleHT;
  const body = locale === 'fr' ? tip.bodyFR : locale === 'en' ? tip.bodyEN : tip.bodyHT;
  const counter = t('tips.counter').replace('{current}', String(tipIndex + 1)).replace('{total}', String(BUSINESS_TIPS.length));

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-5 shadow-sm animate-fade-up">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{tip.emoji}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/60 text-[var(--c-text2)]">
          {t(`tips.cat_${tip.category}`)}
        </span>
        <span className="text-[11px] font-bold text-[var(--c-primary)] ml-auto">💡 {t('tips.daily_tip')}</span>
      </div>
      <p className="font-heading font-bold text-[15px] text-[var(--c-text)] mb-1">{title}</p>
      <p className="text-[14px] text-[var(--c-text2)] leading-relaxed line-clamp-3">{body}</p>
      <div className="flex items-center justify-between mt-3">
        <Link to="/tips" className="text-[13px] font-bold text-[var(--c-primary)] flex items-center gap-1">
          {t('tips.see_all')} <RiArrowRightLine className="h-3.5 w-3.5" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--c-muted)]">{counter}</span>
          <button
            type="button"
            onClick={() => setManualOffset((o) => o + 1)}
            className="text-[12px] font-bold text-[var(--c-primary)] px-2 py-1 rounded-lg hover:bg-white/50 transition-colors"
          >
            {t('tips.next')} →
          </button>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon, iconBg, iconColor, label, value, valueColor }: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  label: string; value: string; valueColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 min-w-[150px] flex items-center gap-3 flex-shrink-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium text-[#6B7280] mb-0.5 whitespace-nowrap">{label}</p>
        <p className={`text-[13px] font-bold ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

const NOTE_COLORS: Record<string, string> = {
  yellow: 'bg-[#FEF9C3]', green: 'bg-[#D1FAE5]', blue: 'bg-[#DBEAFE]', pink: 'bg-[#FCE7F3]', white: 'bg-white',
};

function RecentNotesWidget({ vendorId, t }: { vendorId: string; t: (k: string) => string }) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);

  useEffect(() => {
    if (!vendorId) return;
    getVendorRecords('notes', vendorId).then((all) => {
      all.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
      setNotes(all.slice(0, 2));
    });
  }, [vendorId]);

  if (notes.length === 0) return null;

  return (
    <div className="card p-4 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[14px] font-heading font-bold text-[var(--c-text)] flex items-center gap-2">
          📝 {t('notes.recent')}
        </h3>
        <Link to="/notes" className="text-[12px] font-bold text-[var(--c-primary)]">
          {t('notes.see_all')} →
        </Link>
      </div>
      <div className="space-y-2">
        {notes.map((note) => (
          <Link key={note.id} to="/notes"
            className={`block p-3 rounded-xl text-[13px] ${NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow} transition-colors hover:opacity-80`}>
            {note.title && <p className="font-bold text-[var(--c-text)] truncate">{note.title}</p>}
            <p className="text-[var(--c-text2)] line-clamp-2 whitespace-pre-line">{note.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

const EXPENSE_EMOJIS: Record<string, string> = { rent: '🏠', transport: '🚐', phone: '📱', salary: '💰', fuel: '⛽', supplies: '🛒', other: '📋' };

function RecurringExpenseReminder({ vendorId, t, locale }: { vendorId: string; t: (k: string) => string; locale: Locale }) {
  const [dueExpenses, setDueExpenses] = useState<ExpenseRecord[]>([]);

  useEffect(() => {
    if (!vendorId) return;
    getVendorRecords('expenses', vendorId).then((all) => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const dayOfMonth = today.getDate();
      const due = all.filter((e) => {
        if (!e.is_recurring) return false;
        if (e.recurrence === 'daily') return true;
        if (e.recurrence === 'weekly') {
          const expDay = new Date(e.date).getDay();
          return expDay === dayOfWeek;
        }
        if (e.recurrence === 'monthly') {
          const expDate = new Date(e.date).getDate();
          return expDate === dayOfMonth;
        }
        return false;
      });
      setDueExpenses(due);
    });
  }, [vendorId]);

  if (dueExpenses.length === 0) return null;

  return (
    <div className="card p-4 border-l-4 border-l-[#F4A261] space-y-2">
      <p className="text-[13px] font-bold text-[#92400E]">💸 {t('expenses.due_today').split(':')[0]}</p>
      {dueExpenses.map((exp) => (
        <div key={exp.id} className="flex items-center gap-2 text-sm">
          <span>{EXPENSE_EMOJIS[exp.category] ?? '📋'}</span>
          <span className="flex-1 text-[var(--c-text)]">
            {exp.description || t(`expenses.cat_${exp.category}`)}
          </span>
          <span className="font-bold text-[#E76F51]">{exp.amount.toLocaleString()} G</span>
        </div>
      ))}
    </div>
  );
}
