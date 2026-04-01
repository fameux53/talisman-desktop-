import { useState, useEffect, useCallback, useMemo } from 'react';
import { RiShoppingBag3Line, RiHandCoinLine, RiArrowDownSLine, RiTimeLine, RiAddLine, RiRefreshLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { getVendorRecords, putInStore, type TransactionRecord, type CreditRecord } from '../services/db';
import { getAllCreditEntriesSecure } from '../services/secureDb';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../utils/currency';
import { useProducts } from '../hooks/useProducts';
import { useProductMap } from '../hooks/useProductMap';
import { toLocalDate, isToday, isYesterday } from '../utils/dateRange';
import { getSyncQueue } from '../services/db';
import Receipt from '../components/Receipt';
import Toast from '../components/Toast';
import api from '../services/api';

type FilterType = 'all' | 'sales' | 'credits' | 'payments' | 'moncash';

interface UnifiedEntry {
  id: string;
  type: 'sale' | 'credit' | 'payment';
  paymentMethod?: 'cash' | 'moncash' | 'credit';
  label: string;
  detail: string;
  amount: number;
  positive: boolean;
  date: string;
  time: string;
  synced: boolean;
  // Extra fields for detail view
  quantity?: number;
  unitPrice?: number;
  productUnit?: string;
  transactionType?: string;
  employeeId?: string | null;
  employeeName?: string | null;
}

const PAGE_SIZE = 20;

/** Normalize a timestamp string so naive UTC timestamps (from the API, no Z suffix)
 *  are consistently parsed as UTC before converting to local time.
 *  Returns null if no valid date can be determined (caller must handle). */
function normalizeTimestamp(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  // If it looks like ISO datetime but has no timezone indicator, it's naive UTC from the server
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(dateStr) && !dateStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr.replace(' ', 'T') + 'Z');
  }
  return new Date(dateStr);
}

export default function HistoryPage() {
  const { t, locale } = useI18n();
  const { products } = useProducts();
  const { productMap: allProductMap } = useProductMap();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [filter, setFilter] = useState<FilterType>('all');
  const [empFilter, setEmpFilter] = useState<string>('all');
  const [allEntries, setAllEntries] = useState<UnifiedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{ productName: string; quantity: number; unitPrice: number; total: number } | null>(null);
  const [toast, setToast] = useState('');

  const loadData = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    try {
      const [localTransactions, creditEntries, syncQueue] = await Promise.all([
        vendorId ? getVendorRecords('transactions', vendorId) : Promise.resolve([]),
        vendorId ? getAllCreditEntriesSecure(vendorId).catch(() => [] as CreditRecord[]) : Promise.resolve([]),
        getSyncQueue().catch(() => []),
      ]);

      // Merge server transactions with local ones (server is source of truth for synced data)
      let transactions = localTransactions;
      if (navigator.onLine && vendorId) {
        try {
          const { data: apiTransactions } = await api.get<TransactionRecord[]>('/transactions', {
            params: { limit: 200 },
          });
          // Persist API transactions into IndexedDB for future offline access
          for (const tx of apiTransactions) await putInStore('transactions', tx);
          // Merge: API + local-only (not yet on server)
          const apiIds = new Set(apiTransactions.map((t) => t.id));
          transactions = [...apiTransactions, ...localTransactions.filter((l) => !apiIds.has(l.id))];
        } catch {
          // Offline or API error — use local data only
        }
      }

      // Build set of pending IDs from sync queue bodies
      const pending = new Set<string>();
      for (const item of syncQueue) {
        const body = item.body as Record<string, unknown> | null;
        if (body && typeof body === 'object' && 'id' in body) {
          pending.add(body.id as string);
        }
      }
      setPendingIds(pending);

      // Use allProductMap (includes inactive) with active products as fallback
      const localProductMap = new Map(products.map((p) => [p.id, p]));

      const unified: UnifiedEntry[] = [];

      for (const tx of transactions) {
        const product = allProductMap.get(tx.product_id ?? '') ?? localProductMap.get(tx.product_id ?? '');
        let label: string;
        if (product) {
          label = product.is_active === false ? `${product.name} ${t('reports.archived_suffix')}` : product.name;
        } else {
          label = t('reports.unknown_product');
        }
        // Use created_at, fall back to synced_at — never use current time
        const d = normalizeTimestamp(tx.created_at) ?? normalizeTimestamp(tx.synced_at) ?? new Date(0);
        unified.push({
          id: tx.id,
          type: 'sale',
          paymentMethod: tx.payment_method,
          label,
          detail: `${Math.round(Number(tx.quantity))}${product?.unit ? ' ' + product.unit : ''} × ${formatCurrency(Number(tx.unit_price), locale)}`,
          amount: Number(tx.total_amount),
          positive: tx.transaction_type === 'SALE',
          date: toLocalDate(tx.created_at ?? tx.synced_at),
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          synced: !!tx.synced_at && !pending.has(tx.id),
          quantity: tx.quantity,
          unitPrice: Number(tx.unit_price),
          productUnit: product?.unit,
          transactionType: tx.transaction_type,
          employeeId: tx.employee_id,
          employeeName: tx.employee_name,
        });
      }

      for (const ce of creditEntries) {
        // Use created_at from the record (set by API / TimestampMixin), fall back to now
        const timestamp = (ce as unknown as { created_at?: string }).created_at;
        const d = normalizeTimestamp(timestamp) ?? new Date(0);
        const isCredit = ce.entry_type === 'CREDIT_GIVEN';
        unified.push({
          id: ce.id,
          type: isCredit ? 'credit' : 'payment',
          label: ce.customer_name,
          detail: ce.description ?? (isCredit ? t('label.credit_given') : t('label.payment_received')),
          amount: ce.amount,
          positive: !isCredit,
          date: toLocalDate(d.toISOString()),
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          synced: !pending.has(ce.id),
        });
      }

      unified.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      setAllEntries(unified);
    } catch (err) {
      console.error('[Talisman] History load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [products, allProductMap, locale, t]);

  useEffect(() => { loadData(); }, [loadData]);

  // Unique employees for filter chips
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, string>();
    allEntries.forEach((e) => { if (e.employeeId && e.employeeName) map.set(e.employeeId, e.employeeName); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allEntries]);

  const filtered = useMemo(() => {
    let result = allEntries;
    // Type filter
    if (filter === 'sales') result = result.filter((e) => e.type === 'sale');
    else if (filter === 'credits') result = result.filter((e) => e.type === 'credit');
    else if (filter === 'moncash') result = result.filter((e) => e.paymentMethod === 'moncash');
    else if (filter === 'payments') result = result.filter((e) => e.type === 'payment');
    // Employee filter
    if (empFilter === 'owner') result = result.filter((e) => !e.employeeId);
    else if (empFilter !== 'all') result = result.filter((e) => e.employeeId === empFilter);
    return result;
  }, [allEntries, filter, empFilter]);

  const visible = filtered.slice(0, visibleCount);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedEntry[]>();
    for (const e of visible) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return Array.from(map.entries());
  }, [visible]);

  const formatDateLabel = (dateStr: string) => {
    if (isToday(dateStr)) return t('history.today');
    if (isYesterday(dateStr)) return t('history.yesterday');
    const d = new Date(dateStr + 'T12:00:00'); // noon to avoid timezone shift
    return d.toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const filterCounts = useMemo(() => {
    const counts = new Map<FilterType, number>();
    counts.set('all', allEntries.length);
    counts.set('sales', allEntries.filter((e) => e.type === 'sale').length);
    counts.set('moncash', allEntries.filter((e) => e.paymentMethod === 'moncash').length);
    counts.set('credits', allEntries.filter((e) => e.type === 'credit').length);
    counts.set('payments', allEntries.filter((e) => e.type === 'payment').length);
    return counts;
  }, [allEntries]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('history.all') },
    { key: 'sales', label: t('history.sales') },
    { key: 'moncash', label: 'MonCash' },
    { key: 'credits', label: t('history.credits') },
    { key: 'payments', label: t('history.payments') },
  ];

  return (
    <div className="space-y-4 animate-fade-up md:max-w-2xl md:mx-auto lg:max-w-4xl pb-20 md:pb-4">
      <Toast msg={toast} />
      <h1 className="font-heading text-xl font-bold text-primary">{t('history.title')}</h1>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => {
          const count = filterCounts.get(f.key) ?? 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => { setFilter(f.key); setVisibleCount(PAGE_SIZE); }}
              className={`h-9 px-4 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                filter === f.key
                  ? 'bg-[var(--c-primary)] text-white shadow-sm'
                  : 'bg-white text-secondary border border-gray-200'
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-[11px] ${filter === f.key ? 'text-white/70' : 'text-muted'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Employee filter */}
      {uniqueEmployees.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button type="button" onClick={() => { setEmpFilter('all'); setVisibleCount(PAGE_SIZE); }}
            className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              empFilter === 'all' ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-secondary border border-gray-200'
            }`}>
            {t('history.all')}
          </button>
          <button type="button" onClick={() => { setEmpFilter('owner'); setVisibleCount(PAGE_SIZE); }}
            className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
              empFilter === 'owner' ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-secondary border border-gray-200'
            }`}>
            👑 {t('employees.role_owner')}
          </button>
          {uniqueEmployees.map((emp) => (
            <button key={emp.id} type="button" onClick={() => { setEmpFilter(emp.id); setVisibleCount(PAGE_SIZE); }}
              className={`h-8 px-3 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
                empFilter === emp.id ? 'bg-[var(--c-primary)] text-white' : 'bg-white text-secondary border border-gray-200'
              }`}>
              👤 {emp.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center mb-4">
            <RiTimeLine className="h-7 w-7 text-[#2D6A4F] opacity-50" />
          </div>
          <h3 className="text-[16px] font-bold text-primary mb-2">{t('empty.history_title')}</h3>
          <p className="text-[14px] text-secondary max-w-[260px] mb-6">{t('empty.history_desc')}</p>
          <button
            type="button"
            onClick={() => document.dispatchEvent(new CustomEvent('open-sale-modal'))}
            className="gradient-primary text-white px-6 py-3 rounded-2xl font-bold text-[14px] flex items-center gap-2"
          >
            <RiAddLine className="h-[18px] w-[18px]" />
            {t('empty.history_cta')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, entries]) => (
            <div key={date}>
              {/* Date header */}
              <p className="text-xs uppercase tracking-wider font-bold text-secondary mb-2 sticky top-0 bg-page py-1 z-10">
                {formatDateLabel(date)}
              </p>

              <div className="space-y-2">
                {entries.map((entry) => {
                  const isExpanded = expandedId === entry.id;
                  const paymentLabel = entry.paymentMethod === 'moncash' ? '📱 MonCash'
                    : entry.paymentMethod === 'credit' ? '📝 ' + t('payment.credit')
                    : '💵 ' + t('payment.cash');
                  const paymentColor = entry.paymentMethod === 'moncash' ? 'bg-[#FFF7ED] text-[#F4A261]'
                    : entry.paymentMethod === 'credit' ? 'bg-[#FEF2F2] text-[#E76F51]'
                    : 'bg-emerald-50 text-emerald-700';

                  return (
                    <div
                      key={entry.id}
                      className={`bg-white rounded-2xl shadow-sm border-l-[3px] overflow-hidden cursor-pointer transition-all ${
                        entry.type === 'sale' ? 'border-l-[#2D6A4F]'
                          : entry.type === 'credit' ? 'border-l-[#F4A261]'
                          : 'border-l-emerald-500'
                      } ${isExpanded ? 'ring-1 ring-gray-200' : ''}`}
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      {/* Collapsed summary */}
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm ${
                              entry.type === 'sale' ? 'bg-gradient-to-br from-[#1B4332] to-[#40916C]'
                                : entry.type === 'credit' ? 'bg-gradient-to-br from-[#E76F51] to-[#F4A261]'
                                : 'bg-gradient-to-br from-emerald-500 to-emerald-400'
                            }`}>
                              {entry.type === 'sale' ? <RiShoppingBag3Line className="h-[18px] w-[18px]" /> : <RiHandCoinLine className="h-[18px] w-[18px]" />}
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold text-primary">{entry.label}</p>
                              <p className="text-[12px] text-muted">
                                {entry.time} — {entry.detail}
                                {entry.employeeName && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-secondary bg-page px-1.5 py-0.5 rounded-full">
                                    👤 {t('employees.recorded_by').replace('{name}', entry.employeeName)}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 flex items-center gap-2">
                            <p className={`text-[16px] font-bold ${entry.positive ? 'text-[#2D6A4F]' : 'text-[#E76F51]'}`}>
                              {entry.positive ? '+' : '-'}{formatCurrency(entry.amount, locale)}
                            </p>
                            <RiArrowDownSLine className={`h-4 w-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Status row: sync + payment method */}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                          <div className={`w-2 h-2 rounded-full ${entry.synced ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          <span className="text-[12px] font-medium text-secondary">
                            {entry.synced ? `${t('history.synced')} ✓` : t('history.pending')}
                          </span>
                          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${paymentColor}`}>
                            {paymentLabel}
                          </span>
                        </div>
                      </div>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-page space-y-2 animate-fade-in">
                          {entry.type === 'sale' && entry.quantity != null && (
                            <>
                              <DetailRow label={t('history.product')} value={entry.label} />
                              <DetailRow label={t('history.quantity')} value={`${Math.round(Number(entry.quantity))}${entry.productUnit ? ' ' + entry.productUnit : ''}`} />
                              <DetailRow label={t('history.unit_price')} value={formatCurrency(entry.unitPrice ?? 0, locale)} />
                              <DetailRow label={t('history.total')} value={formatCurrency(entry.amount, locale)} bold />
                            </>
                          )}
                          {(entry.type === 'credit' || entry.type === 'payment') && (
                            <>
                              <DetailRow label={t('history.customer')} value={entry.label} />
                              <DetailRow label={t('history.total')} value={formatCurrency(entry.amount, locale)} bold />
                              {entry.detail && <DetailRow label={t('history.note')} value={entry.detail} />}
                              <DetailRow label={t('history.date')} value={`${formatDateLabel(entry.date)}, ${entry.time}`} />
                            </>
                          )}
                          {entry.employeeName && (
                            <DetailRow label={t('transaction.recorded_by')} value={`👤 ${entry.employeeName}`} />
                          )}
                          <DetailRow label={t('history.payment_method')} value={paymentLabel} />
                          <DetailRow label={t('history.sync_status')} value={entry.synced ? `${t('history.synced')} ✓` : t('history.pending')} />
                          <DetailRow label={t('history.transaction_id')} value={entry.id.slice(0, 8) + '...'} mono />
                          {/* Action buttons */}
                          <div className="flex gap-2 pt-2">
                            {entry.type === 'sale' && entry.quantity != null && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setReceiptData({ productName: entry.label, quantity: entry.quantity!, unitPrice: entry.unitPrice ?? 0, total: entry.amount }); }}
                                className="flex-1 h-9 rounded-xl bg-[var(--c-primary)] text-white text-[13px] font-bold flex items-center justify-center gap-1.5"
                              >
                                {t('history.view_receipt')}
                              </button>
                            )}
                            {!entry.synced && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setToast(t('history.retry'));
                                  setTimeout(() => setToast(''), 2500);
                                  // Reload data without skeleton flash or collapsing
                                  const currentExpanded = expandedId;
                                  loadData(false).then(() => setExpandedId(currentExpanded));
                                }}
                                className="flex-1 h-9 rounded-xl border-2 border-amber-400 text-amber-600 text-[13px] font-bold flex items-center justify-center gap-1.5"
                              >
                                <RiRefreshLine className="h-4 w-4" />
                                {t('history.retry_sync')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load more */}
          {visibleCount < filtered.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="w-full py-3 text-sm font-medium text-[var(--c-primary)] flex items-center justify-center gap-1"
            >
              <RiArrowDownSLine className="h-5 w-5" />
              {t('history.load_more')} ({filtered.length - visibleCount} {t('label.entries')})
            </button>
          )}
        </div>
      )}
      {/* Receipt overlay */}
      {receiptData && (
        <Receipt
          productName={receiptData.productName}
          quantity={receiptData.quantity}
          unitPrice={receiptData.unitPrice}
          total={receiptData.total}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-[12px] text-muted">{label}</span>
      <span className={`text-[13px] text-primary ${bold ? 'font-bold' : ''} ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  );
}
