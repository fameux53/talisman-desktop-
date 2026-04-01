import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { RiSearchLine, RiCloseLine, RiShoppingBag3Line, RiArrowRightLine } from 'react-icons/ri';
import { useI18n, type Locale } from '../i18n';
import { getVendorRecords, type ProductRecord, type TransactionRecord, type CustomerRecord, type CreditRecord } from '../services/db';
import { getAllCustomersSecure, getAllCreditEntriesSecure } from '../services/secureDb';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../utils/currency';

interface SearchResults {
  products: ProductRecord[];
  customers: CustomerRecord[];
  transactions: (TransactionRecord & { _productName?: string; _productEmoji?: string })[];
  creditEntries: (CreditRecord & { _type: 'credit' | 'payment' })[];
}

const HIDDEN_ROUTES = ['/reports', '/sales'];

// Session-level cache — avoids re-fetching on every keystroke
let _cachedProducts: ProductRecord[] | null = null;
let _cachedCustomers: CustomerRecord[] | null = null;
let _cachedTransactions: TransactionRecord[] | null = null;
let _cachedCreditEntries: CreditRecord[] | null = null;
let _productMap: Map<string, ProductRecord> | null = null;

function invalidateCache() {
  _cachedProducts = null;
  _cachedCustomers = null;
  _cachedTransactions = null;
  _cachedCreditEntries = null;
  _productMap = null;
}

function formatTimeAgo(dateStr: string | undefined, locale: Locale, t: (k: string) => string): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('time.just_now');
  if (mins < 60) return t('time.minutes_ago').replace('{n}', String(mins));
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.hours_ago').replace('{n}', String(hrs));
  const days = Math.floor(hrs / 24);
  if (days < 7) return t('time.days_ago').replace('{n}', String(days));
  return new Date(dateStr).toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, { day: 'numeric', month: 'short' });
}

export default function GlobalSearch() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  // Invalidate search cache when vendor changes (login/logout)
  useEffect(() => { invalidateCache(); }, [vendorId]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hidden = HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r));

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults(null); return; }
    const lower = q.toLowerCase();

    // Use session cache when available
    if (!vendorId) { setResults(null); return; }
    if (!_cachedProducts) _cachedProducts = await getVendorRecords('products', vendorId);
    if (!_cachedCustomers) _cachedCustomers = await getAllCustomersSecure(vendorId).catch(() => [] as CustomerRecord[]);
    if (!_cachedTransactions) _cachedTransactions = await getVendorRecords('transactions', vendorId);
    if (!_cachedCreditEntries) _cachedCreditEntries = await getAllCreditEntriesSecure(vendorId).catch(() => [] as CreditRecord[]);
    if (!_productMap) _productMap = new Map(_cachedProducts.map((p) => [p.id, p]));

    const products = _cachedProducts;
    const customers = _cachedCustomers;
    const transactions = _cachedTransactions;
    const creditEntries = _cachedCreditEntries;
    const productMap = _productMap;

    // Search products by name, creole name, or category
    const matchedProducts = products
      .filter((p) => p.is_active && (
        p.name.toLowerCase().includes(lower) ||
        p.name_creole?.toLowerCase().includes(lower) ||
        (p as any).category?.toLowerCase().includes(lower)
      ))
      .slice(0, 3);

    // Search customers by name AND phone number
    const matchedCustomers = customers
      .filter((c) => c.name.toLowerCase().includes(lower) || (c.phone && c.phone.includes(q.trim())))
      .slice(0, 3);

    // Search transactions by product name, creole name, or notes
    const matchedTransactions = transactions
      .filter((tx) => {
        const product = productMap.get(tx.product_id ?? '');
        const productName = product?.name?.toLowerCase() ?? '';
        const productCreole = product?.name_creole?.toLowerCase() ?? '';
        const notes = tx.notes?.toLowerCase() ?? '';
        return productName.includes(lower) || productCreole.includes(lower) || notes.includes(lower);
      })
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
      .slice(0, 3)
      .map((tx) => {
        const product = productMap.get(tx.product_id ?? '');
        return { ...tx, _productName: product?.name, _productEmoji: (product as any)?.emoji };
      });

    // Search credit entries by customer name or description/notes
    const matchedCreditEntries = creditEntries
      .filter((ce) => {
        const name = ce.customer_name?.toLowerCase() ?? '';
        const desc = ce.description?.toLowerCase() ?? '';
        return name.includes(lower) || desc.includes(lower);
      })
      .slice(0, 3)
      .map((ce) => ({ ...ce, _type: (ce.entry_type === 'CREDIT_GIVEN' ? 'credit' : 'payment') as 'credit' | 'payment' }));

    setResults({ products: matchedProducts, customers: matchedCustomers, transactions: matchedTransactions, creditEntries: matchedCreditEntries });
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setOpen(value.length >= 2);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 250);
  }, [search]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on navigation + invalidate cache
  useEffect(() => {
    setOpen(false);
    setQuery('');
    invalidateCache();
  }, [location.pathname]);

  const hasResults = results && (results.products.length > 0 || results.customers.length > 0 || results.transactions.length > 0 || results.creditEntries.length > 0);
  const totalResults = results ? results.products.length + results.customers.length + results.transactions.length + results.creditEntries.length : 0;

  if (hidden) return null;

  return (
    <div ref={containerRef} className="sticky top-0 z-20 bg-[var(--c-bg)]/95 md:bg-[#F0F1F3]/95 lg:bg-[#ECEDF0]/95 backdrop-blur-sm pb-2 pt-1 px-4 md:px-6 lg:px-8">
      <div className="relative">
        <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--c-muted)] h-[18px] w-[18px]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          placeholder={t('search.placeholder')}
          className="w-full bg-white text-[var(--c-text)] rounded-full py-3 pl-11 pr-10 text-[14px] outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 shadow-sm placeholder:text-[var(--c-muted)] font-body"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults(null); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--c-muted)]"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute left-4 right-4 md:left-6 md:right-6 lg:left-8 lg:right-auto top-full mt-1 bg-white rounded-2xl shadow-lg max-h-[420px] overflow-y-auto z-30 border border-gray-100 lg:max-w-lg animate-fade-in">

          {/* No results */}
          {!hasResults && results !== null && (
            <div className="px-4 py-10 text-center">
              <RiSearchLine className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-[var(--c-muted)]">
                {t('search.no_results').replace('{query}', query)}
              </p>
            </div>
          )}

          {/* ── Products section ── */}
          {results && results.products.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[11px] uppercase tracking-wider font-bold text-[var(--c-text2)] border-l-[3px] border-l-[#2D6A4F] ml-2">
                {t('search.products')}
              </p>
              {results.products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setOpen(false); navigate('/inventory'); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 bg-[#F0FDF4]">
                    {(p as any).emoji || p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">{p.name}</p>
                    <p className="text-[12px] text-[var(--c-muted)]">
                      {formatCurrency(p.current_price, locale)} / {p.unit}
                      <span className="mx-1">—</span>
                      {t('search.stock')}: {p.stock_quantity}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Customers section ── */}
          {results && results.customers.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[11px] uppercase tracking-wider font-bold text-[var(--c-text2)] border-l-[3px] border-l-[#F4A261] ml-2">
                {t('search.customers')}
              </p>
              {results.customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setOpen(false); navigate('/credit'); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#FFF7ED] text-[#F4A261] flex items-center justify-center font-heading font-bold text-sm flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">{c.name}</p>
                    {c.phone && <p className="text-[12px] text-[var(--c-muted)]">{c.phone}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[14px] font-bold ${c.balance > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                      {formatCurrency(c.balance, locale)}
                    </span>
                    <p className="text-[10px] text-[var(--c-muted)]">{t('search.balance')}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Transactions section ── */}
          {results && results.transactions.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[11px] uppercase tracking-wider font-bold text-[var(--c-text2)] border-l-[3px] border-l-[#40916C] ml-2">
                {t('search.transactions')}
              </p>
              {results.transactions.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => { setOpen(false); navigate('/history'); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#F0FDF4] text-[#2D6A4F] flex items-center justify-center flex-shrink-0">
                    {tx._productEmoji || <RiShoppingBag3Line className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">
                      {tx._productName ?? (tx.transaction_type === 'SALE' ? t('history.sales') : t('history.credits'))}
                      <span className="font-normal text-[var(--c-muted)]"> × {tx.quantity}</span>
                    </p>
                    <p className="text-[12px] text-[var(--c-muted)]">
                      {formatCurrency(Number(tx.total_amount), locale)}
                      <span className="mx-1">—</span>
                      {formatTimeAgo(tx.created_at, locale, t)}
                      {tx.payment_method && tx.payment_method !== 'cash' && (
                        <span className="ml-1">{tx.payment_method === 'moncash' ? '📱' : '📝'}</span>
                      )}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Credit entries section ── */}
          {results && results.creditEntries.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[11px] uppercase tracking-wider font-bold text-[var(--c-text2)] border-l-[3px] border-l-[#F4A261] ml-2">
                {t('history.credits')}
              </p>
              {results.creditEntries.map((ce) => (
                <button
                  key={ce.id}
                  type="button"
                  onClick={() => { setOpen(false); navigate('/credit'); }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-sm flex-shrink-0 ${
                    ce._type === 'credit' ? 'bg-[#FFF7ED] text-[#F4A261]' : 'bg-[#F0FDF4] text-emerald-600'
                  }`}>
                    {ce.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--c-text)] truncate">{ce.customer_name}</p>
                    <p className="text-[12px] text-[var(--c-muted)] truncate">
                      {ce.description || (ce._type === 'credit' ? t('label.credit_given') : t('label.payment_received'))}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[14px] font-bold ${ce._type === 'credit' ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                      {ce._type === 'credit' ? '+' : '-'}{formatCurrency(ce.amount, locale)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── See all results footer ── */}
          {hasResults && totalResults > 0 && (
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/history'); }}
              className="w-full px-4 py-3 flex items-center justify-center gap-1.5 text-[13px] font-bold text-[var(--c-primary)] hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              {t('search.see_all')} <RiArrowRightLine className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
