import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { RiArrowLeftLine, RiAlertFill, RiAddLine, RiCloseLine, RiArrowRightSLine, RiHandCoinLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import Toast from '../components/Toast';
import DatePicker from '../components/DatePicker';
import api from '../services/api';
import { putInStore, upsertCustomer, type CreditRecord } from '../services/db';
import { putCreditEntrySecure, getAllCreditEntriesSecure, getAllCustomersSecure } from '../services/secureDb';
import { calculateTrustScore, getTrustColors, getTrustStars } from '../utils/trustScore';
import { getBalanceUrl, getWhatsAppShareUrl } from '../utils/balanceToken';
import QRDisplay from '../components/QRDisplay';
import { useLinkedNotes } from '../hooks/useLinkedNotes';

interface CustomerBalance { customer_name: string; customer_phone: string | null; balance: number; entries: CreditRecord[]; }
interface CreditSummary { total_outstanding: number; unique_customers: number; overdue_entries: number; }

export default function CreditPage() {
  const { t } = useI18n();
  const enqueue = useSyncStore((s) => s.enqueue);
  const vendor = useAuthStore((s) => s.vendor);
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [summary, setSummary] = useState<CreditSummary>({ total_outstanding: 0, unique_customers: 0, overdue_entries: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<'credit' | 'payment' | null>(null);
  const [toast, setToast] = useState('');
  const [qrData, setQrData] = useState<{ url: string; name: string } | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const [cRes, sRes] = await Promise.all([api.get<CustomerBalance[]>('/credit'), api.get<CreditSummary>('/credit/summary')]);
        setCustomers(cRes.data); setSummary(sRes.data);
        for (const c of cRes.data) for (const e of c.entries) await putInStore('creditEntries', e);
      } else {
        const all = await getAllCreditEntriesSecure(vendor?.id);
        const grouped = groupByCustomer(all); setCustomers(grouped); setSummary(buildSummary(grouped));
      }
    } catch { const all = await getAllCreditEntriesSecure(vendor?.id); const g = groupByCustomer(all); setCustomers(g); setSummary(buildSummary(g)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const customerNames = useMemo(() => customers.map((c) => c.customer_name), [customers]);
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter((c) => c.customer_name.toLowerCase().includes(q) || c.customer_phone?.toLowerCase().includes(q));
  }, [customers, customerSearch]);
  const detail = useMemo(() => customers.find((c) => c.customer_name === selectedCustomer) ?? null, [customers, selectedCustomer]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  // ── Phone: detail view (full screen, shown only on mobile when customer is selected) ──
  if (selectedCustomer && detail) {
    const hasOverdue = detail.entries.some((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && new Date(e.due_date) < new Date());
    return (
      <>
        {/* Mobile only: full-screen detail */}
        <div className="md:hidden space-y-4 animate-fade-up">
          <Toast msg={toast} />
          <button type="button" onClick={() => setSelectedCustomer(null)} className="flex items-center gap-1 text-[var(--c-primary)] font-medium h-12">
            <RiArrowLeftLine className="h-5 w-5" /> {t('action.back')}
          </button>
          <CustomerDetail detail={detail} hasOverdue={hasOverdue} t={t} vendorId={vendor?.id} vendorName={vendor?.display_name} onShowQr={setQrData} />
          <button type="button" onClick={() => setSheetMode('payment')}
            className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md">
            {t('action.record_payment')}
          </button>
          <CustomerLedger entries={detail.entries} t={t} />
          {sheetMode === 'payment' && (
            <PaymentSheet customerName={detail.customer_name} customerPhone={detail.customer_phone ?? undefined} currentBalance={detail.balance} t={t} vendor={vendor} enqueue={enqueue}
              onClose={() => setSheetMode(null)} onSaved={() => { setSheetMode(null); showToast(t('message.payment_recorded')); refresh(); }} />
          )}
        </div>
        {/* Desktop only: the full grid layout with detail panel */}
        <div className="hidden md:block space-y-4 animate-fade-up">
          <Toast msg={toast} />
          <div className="rounded-3xl p-5 text-white" style={{ background: 'var(--gradient-orange)' }}>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="font-heading text-2xl font-extrabold">{Number(summary.total_outstanding).toLocaleString()}</p><p className="text-sm text-white/80">{t('label.outstanding')} ({t('label.currency')})</p></div>
              <div><p className="font-heading text-2xl font-extrabold">{summary.unique_customers}</p><p className="text-sm text-white/80">{t('label.customers')}</p></div>
              <div><p className={`font-heading text-2xl font-extrabold ${summary.overdue_entries > 0 ? 'text-[#FFD166]' : ''}`}>{summary.overdue_entries}</p><p className="text-sm text-white/80">{t('label.overdue')}</p></div>
            </div>
          </div>
          <div className="grid md:grid-cols-5 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 lg:col-span-1 space-y-2">
              {filteredCustomers.map((c) => (
                <div key={c.customer_name} onClick={() => setSelectedCustomer(c.customer_name)}
                  className={`card p-4 cursor-pointer transition-all ${selectedCustomer === c.customer_name ? 'ring-2 ring-[#F4A261]' : ''}`}>
                  <p className="font-heading font-bold text-[15px] text-[var(--c-text)]">{c.customer_name}</p>
                  <p className="text-[13px] text-[var(--c-text2)]">{Number(c.balance).toLocaleString()} {t('label.currency')}</p>
                </div>
              ))}
            </div>
            <div className="md:col-span-3 lg:col-span-2">
              <div className="space-y-4 animate-fade-up">
                <CustomerDetail detail={detail} hasOverdue={hasOverdue} t={t} vendorId={vendor?.id} vendorName={vendor?.display_name} onShowQr={setQrData} />
                <button type="button" onClick={() => setSheetMode('payment')}
                  className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md">
                  {t('action.record_payment')}
                </button>
                <CustomerLedger entries={detail.entries} t={t} />
              </div>
              {sheetMode === 'payment' && (
                <PaymentSheet customerName={detail.customer_name} customerPhone={detail.customer_phone ?? undefined} currentBalance={detail.balance} t={t} vendor={vendor} enqueue={enqueue}
                  onClose={() => setSheetMode(null)} onSaved={() => { setSheetMode(null); showToast(t('message.payment_recorded')); refresh(); }} />
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── List view (phone) / Split view (tablet+) ──
  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />
      {/* Summary banner */}
      <div className="rounded-3xl p-5 text-white" style={{ background: 'var(--gradient-orange)' }}>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="font-heading text-2xl font-extrabold">{Number(summary.total_outstanding).toLocaleString()}</p><p className="text-sm text-white/80">{t('label.outstanding')} ({t('label.currency')})</p></div>
          <div><p className="font-heading text-2xl font-extrabold">{summary.unique_customers}</p><p className="text-sm text-white/80">{t('label.customers')}</p></div>
          <div>
            <p className={`font-heading text-2xl font-extrabold ${summary.overdue_entries > 0 ? 'text-[#FFD166]' : ''}`}>
              {summary.overdue_entries > 0 && <RiAlertFill className="inline h-4 w-4 mb-0.5 mr-0.5" />}{summary.overdue_entries}
            </p>
            <p className="text-sm text-white/80">{t('label.overdue')}</p>
          </div>
        </div>
      </div>

      {/* Tablet+: side-by-side list + detail */}
      <div className="md:grid md:grid-cols-5 md:gap-4 lg:grid-cols-3 lg:gap-6 md:items-start">
        {/* Left: customer list */}
        <div className="md:col-span-2 lg:col-span-1 space-y-3">
          {/* Search */}
          {customers.length > 0 && (
            <div className="relative">
              <RiArrowRightSLine className="absolute left-3.5 top-3 h-5 w-5 text-gray-400 rotate-180" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder={t('customer.search')}
                className="w-full h-11 pl-11 pr-4 rounded-full border border-gray-200 text-sm font-body bg-white focus:ring-2 focus:ring-[var(--c-primary)] focus:border-transparent"
              />
            </div>
          )}

          {loading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
          ) : filteredCustomers.length === 0 && !customerSearch ? (
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#F4A261]/15 flex items-center justify-center">
                  <RiHandCoinLine className="h-5 w-5 text-[#F4A261]" />
                </div>
                <h3 className="font-heading font-bold text-base text-[var(--c-text)]">{t('credit.onboarding_title')}</h3>
              </div>
              <p className="text-sm text-[var(--c-text2)] leading-relaxed">{t('credit.onboarding_body')}</p>
              <button type="button" onClick={() => setSheetMode('credit')}
                className="btn w-full h-12 rounded-xl bg-[#F4A261] text-white font-heading font-bold text-base shadow-md gap-2">
                <RiAddLine className="h-5 w-5" />{t('credit.first_cta')}
              </button>
            </div>
          ) : (
            <div className="space-y-2 md:max-h-[70vh] md:overflow-y-auto md:scrollbar-hide">
              {filteredCustomers.map((c) => {
                const hasOverdue = c.entries.some((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && new Date(e.due_date) < new Date());
                const isActive = selectedCustomer === c.customer_name;
                return (
                  <div key={c.customer_name} onClick={() => setSelectedCustomer(c.customer_name)}
                    className={`card p-4 flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer ${isActive ? 'md:ring-2 md:ring-[var(--c-primary)]' : ''}`} role="button" tabIndex={0}>
                    <div className="w-11 h-11 rounded-full gradient-teal text-white flex items-center justify-center font-heading text-lg font-bold flex-shrink-0">
                      {c.customer_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-heading font-semibold text-[15px] md:text-base truncate">{c.customer_name}</p>
                        {(() => {
                          const trust = calculateTrustScore(c.balance, c.entries);
                          const colors = getTrustColors(trust.label);
                          return (
                            <span className={`hidden lg:inline text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} flex-shrink-0`}>
                              {trust.label === 'new' ? '🆕' : getTrustStars(trust.score)} {t(`trust.${trust.label}`)}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-[var(--c-text2)]">{c.entries.length} {t('label.entries')}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-heading font-bold text-base ${hasOverdue ? 'text-[#E76F51]' : Number(c.balance) > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                        {Number(c.balance).toLocaleString()} {t('label.currency')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: detail panel (3/5, tablet+ only) */}
        <div className="hidden md:block md:col-span-3 lg:col-span-2">
          {detail ? (() => {
            const hasOverdue = detail.entries.some((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && new Date(e.due_date) < new Date());
            return (
              <div className="space-y-4 animate-fade-up">
                <CustomerDetail detail={detail} hasOverdue={hasOverdue} t={t} vendorId={vendor?.id} vendorName={vendor?.display_name} onShowQr={setQrData} />
                <button type="button" onClick={() => setSheetMode('payment')}
                  className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md">
                  {t('action.record_payment')}
                </button>
                <CustomerLedger entries={detail.entries} t={t} />
              </div>
            );
          })() : (
            <div className="card p-10 text-center text-[var(--c-muted)]">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-sm">{t('label.select_product')}</p>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={() => setSheetMode('credit')}
        className="md:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full bg-[#F4A261] text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40">
        <RiAddLine className="h-7 w-7" />
      </button>

      {sheetMode === 'credit' && (
        <CreditSheet customerNames={customerNames} t={t} vendor={vendor} enqueue={enqueue}
          onClose={() => setSheetMode(null)} onSaved={() => { setSheetMode(null); showToast(t('message.credit_recorded')); refresh(); }} />
      )}
      {sheetMode === 'payment' && detail && (
        <PaymentSheet customerName={detail.customer_name} customerPhone={detail.customer_phone ?? undefined} currentBalance={detail.balance} t={t} vendor={vendor} enqueue={enqueue}
          onClose={() => setSheetMode(null)} onSaved={() => { setSheetMode(null); showToast(t('message.payment_recorded')); refresh(); }} />
      )}

      {/* QR Code display */}
      {qrData && (
        <QRDisplay
          data={qrData.url}
          title={t('qr.customer_balance')}
          subtitle={`${t('qr.scan_to_check')} — ${qrData.name}`}
          vendorName={vendor?.display_name}
          onClose={() => setQrData(null)}
        />
      )}
    </div>
  );
}

/* ── Customer detail card ── */
function CustomerDetail({ detail, hasOverdue, t, vendorId, vendorName, onShowQr }: {
  detail: CustomerBalance; hasOverdue: boolean; t: (k: string) => string;
  vendorId?: string; vendorName?: string; onShowQr?: (data: { url: string; name: string }) => void;
}) {
  const trust = calculateTrustScore(detail.balance, detail.entries);
  const colors = getTrustColors(trust.label);
  const creditCount = detail.entries.filter((e) => e.entry_type === 'CREDIT_GIVEN').length;
  const paymentCount = detail.entries.filter((e) => e.entry_type === 'PAYMENT_RECEIVED').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = detail.entries.filter((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && e.due_date < today).length;
  const onTimeCount = creditCount > 0 ? creditCount - overdueCount : 0;
  const onTimePct = creditCount > 0 ? Math.round((onTimeCount / creditCount) * 100) : 0;
  return (
    <>
      <div className="card p-5 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-[#F4A261] text-white flex items-center justify-center font-heading text-2xl font-bold mb-2">
          {detail.customer_name.charAt(0)}
        </div>
        <p className="font-heading text-xl font-bold">{detail.customer_name}</p>
        <span className={`inline-block text-[12px] font-semibold px-3 py-1 rounded-full mt-1 ${colors.bg} ${colors.text}`}>
          {trust.label === 'new' ? '🆕' : getTrustStars(trust.score)} {t(`trust.${trust.label}`)} — {t('trust.title')}
        </span>
        {detail.customer_phone && <p className="text-sm text-[var(--c-text2)] mt-1">{detail.customer_phone}</p>}
        <p className={`font-heading text-3xl font-extrabold mt-3 ${hasOverdue ? 'text-[#E76F51]' : Number(detail.balance) > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
          {Number(detail.balance).toLocaleString()} {t('label.currency')}
        </p>
        <p className="text-xs text-[var(--c-text2)] mt-0.5">{t('trust.current_balance')}</p>
        {trust.score <= 2 && trust.label !== 'new' && (
          <div className="mt-3 bg-[#FEF2F2] rounded-xl px-3 py-2.5 flex items-start gap-2 text-left">
            <span className="text-sm flex-shrink-0">⚠️</span>
            <p className="text-[13px] text-[#991B1B] font-medium">{t('trust.warning_risky')}</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="font-heading font-bold text-lg text-[#F4A261]">{creditCount}</p>
          <p className="text-[11px] text-[var(--c-text2)]">{t('trust.credits_given')}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-heading font-bold text-lg text-emerald-600">{paymentCount}</p>
          <p className="text-[11px] text-[var(--c-text2)]">{t('trust.payments_received')}</p>
        </div>
        <div className="card p-3 text-center">
          <p className={`font-heading font-bold text-lg ${onTimePct >= 70 ? 'text-emerald-600' : onTimePct >= 40 ? 'text-[#F4A261]' : 'text-[#E76F51]'}`}>
            {creditCount > 0 ? `${onTimePct}%` : '—'}
          </p>
          <p className="text-[11px] text-[var(--c-text2)]">{t('trust.on_time')}</p>
        </div>
      </div>
      {/* Share balance link */}
      {vendorId && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const url = getBalanceUrl(vendorId, detail.customer_name);
              const waUrl = getWhatsAppShareUrl(
                detail.customer_phone, vendorName ?? 'Talisman',
                detail.customer_name, detail.balance, url, t('label.currency'),
              );
              window.open(waUrl, '_blank');
            }}
            className="btn flex-1 h-11 rounded-xl bg-[#25D366] text-white font-heading font-bold text-sm gap-2 shadow-sm"
          >
            <span>📲</span> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              const url = getBalanceUrl(vendorId, detail.customer_name);
              navigator.clipboard.writeText(url);
            }}
            className="btn h-11 px-4 rounded-xl bg-white border border-gray-200 text-[var(--c-text2)] font-heading font-bold text-sm gap-2"
          >
            🔗 {t('balance.share_link')}
          </button>
          <button
            type="button"
            onClick={() => onShowQr?.({ url: getBalanceUrl(vendorId, detail.customer_name), name: detail.customer_name })}
            className="btn h-11 w-11 rounded-xl bg-white border border-gray-200 text-[var(--c-text2)] font-heading font-bold text-sm flex items-center justify-center"
          >
            📱
          </button>
        </div>
      )}
      {/* Linked notes for this customer */}
      {vendorId && <CustomerLinkedNotes vendorId={vendorId} customerName={detail.customer_name} t={t} />}
    </>
  );
}

const CREDIT_NOTE_COLORS: Record<string, string> = {
  yellow: 'bg-[#FEF9C3]', green: 'bg-[#D1FAE5]', blue: 'bg-[#DBEAFE]', pink: 'bg-[#FCE7F3]', white: 'bg-white',
};

function CustomerLinkedNotes({ vendorId, customerName, t }: { vendorId: string; customerName: string; t: (k: string) => string }) {
  const { notes, loading } = useLinkedNotes({ vendorId, customerId: customerName });

  if (loading || notes.length === 0) return null;

  return (
    <div className="card p-4 space-y-2">
      <p className="text-sm font-bold text-[var(--c-text)]">{t('notes.add_note_to_customer')}</p>
      {notes.map((note) => (
        <div key={note.id} className={`p-3 rounded-xl text-[13px] ${CREDIT_NOTE_COLORS[note.color] ?? CREDIT_NOTE_COLORS.yellow}`}>
          {note.title && <p className="font-bold text-[var(--c-text)] truncate">{note.title}</p>}
          <p className="text-[var(--c-text2)] line-clamp-2 whitespace-pre-line">{note.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Customer ledger timeline ── */
function CustomerLedger({ entries, t }: { entries: CreditRecord[]; t: (k: string) => string }) {
  return (
    <>
      <h3 className="font-heading font-bold text-lg text-[var(--c-text)] mb-3">{t('label.ledger')}</h3>
      <div className="relative pl-5">
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-200" />
        {entries.map((entry) => {
          const isCredit = entry.entry_type === 'CREDIT_GIVEN';
          return (
            <div key={entry.id} className="relative pb-4">
              <span className={`absolute left-0 top-1 h-[18px] w-[18px] rounded-full border-2 border-white ${isCredit ? 'bg-[#F4A261]' : 'bg-emerald-500'}`} style={{ marginLeft: '-9px', left: '9px' }} />
              <div className="card px-4 py-3 ml-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className={`font-medium text-sm ${isCredit ? 'text-[#F4A261]' : 'text-emerald-600'}`}>{isCredit ? t('label.credit_given') : t('label.payment_received')}</p>
                    {entry.description && <p className="text-xs text-[var(--c-text2)] mt-0.5 truncate max-w-[180px]">{entry.description}</p>}
                    {entry.due_date && <p className="text-[10px] text-[var(--c-text2)]">{entry.due_date}</p>}
                  </div>
                  <div className="text-right">
                    <p className={`font-heading font-bold ${isCredit ? 'text-[#F4A261]' : 'text-emerald-600'}`}>{isCredit ? '+' : '-'}{Number(entry.amount).toLocaleString()} {t('label.currency')}</p>
                    <p className="text-[10px] text-[var(--c-text2)]">{t('label.balance')}: {Number(entry.balance_after).toLocaleString()} {t('label.currency')}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Credit sheet ── */
function CreditSheet({ customerNames, t, vendor, enqueue, onClose, onSaved }: {
  customerNames: string[]; t: (k: string) => string; vendor: { id: string } | null;
  enqueue: (i: { endpoint: string; method: 'POST' | 'PATCH' | 'DELETE'; body: unknown }) => Promise<void>;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState(''); const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState(''); const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; phone?: string; balance: number }[]>([]);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<{
    name: string; balance: number; creditCount: number; paymentCount: number; overdueCount: number;
    trust: { score: number; label: string };
  } | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleNameChange = async (v: string) => {
    setName(v);
    setSelectedCustomerInfo(null);
    if (v.length < 2) { setSuggestions([]); return; }
    const q = v.toLowerCase();
    try {
      const allCustomers = await getAllCustomersSecure(vendor?.id);
      const matches = allCustomers
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((c) => ({ name: c.name, phone: c.phone, balance: c.balance }));
      if (matches.length > 0) { setSuggestions(matches); return; }
    } catch { /* fallback to simple names */ }
    setSuggestions(customerNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 5).map((n) => ({ name: n, balance: 0 })));
  };
  const selectCustomer = async (s: { name: string; phone?: string; balance: number }) => {
    setName(s.name);
    if (s.phone) setPhone(s.phone);
    setSuggestions([]);
    setErrors((prev) => ({ ...prev, name: undefined }));
    // Load full credit entries for trust calculation
    try {
      const allEntries = await getAllCreditEntriesSecure(vendor?.id);
      const entries = allEntries.filter((e) => e.customer_name === s.name);
      const creditCount = entries.filter((e) => e.entry_type === 'CREDIT_GIVEN').length;
      const paymentCount = entries.filter((e) => e.entry_type === 'PAYMENT_RECEIVED').length;
      const today = new Date().toISOString().slice(0, 10);
      const overdueCount = entries.filter((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && e.due_date < today).length;
      const trust = calculateTrustScore(s.balance, entries);
      setSelectedCustomerInfo({ name: s.name, balance: s.balance, creditCount, paymentCount, overdueCount, trust });
    } catch {
      setSelectedCustomerInfo(null);
    }
  };
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});
  const submitBtnRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Validate
    const newErrors: typeof errors = {};
    if (!name || name.length < 2) newErrors.name = t('validation.customer_name_required');
    if (!amount || Number(amount) <= 0) newErrors.amount = t('validation.amount_min');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      submitBtnRef.current?.classList.remove('animate-shake');
      void submitBtnRef.current?.offsetWidth;
      submitBtnRef.current?.classList.add('animate-shake');
      return;
    }
    setErrors({});
    setSaving(true);
    const apiPayload = { customer_name: name, customer_phone: phone || null, entry_type: 'CREDIT_GIVEN', amount, description: desc || null, due_date: dueDate || null };
    try {
      // Offline-first: write to IndexedDB immediately
      const localEntry = { id: crypto.randomUUID(), vendor_id: vendor?.id ?? '', customer_name: name, customer_phone: phone || undefined, entry_type: 'CREDIT_GIVEN' as const, amount: Number(amount), balance_after: Number(amount), description: desc || undefined, due_date: dueDate || undefined, reminder_sent: false, created_at: new Date().toISOString() };
      await putCreditEntrySecure(localEntry);
      await upsertCustomer(name, phone || undefined, Number(amount), false, vendor?.id);
      onSaved();
      await enqueue({ endpoint: '/credit', method: 'POST', body: apiPayload });
      if (navigator.onLine) { api.post('/credit', apiPayload).catch(() => {}); }
    } catch (err) { console.error('[Talisman] Credit save failed:', err); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-card rounded-t-3xl px-5 pt-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-1"><h3 className="font-heading text-xl font-bold text-primary">{t('action.new_credit')}</h3><button type="button" onClick={onClose} className="p-1.5" aria-label={t('aria.close')}><RiCloseLine className="h-6 w-6 text-gray-400" /></button></div>
        <div className="relative">
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.customer_name')} <span className="text-[#E76F51]">*</span></label>
          <input value={name} onChange={(e) => { handleNameChange(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: undefined })); }} className={`input-field ${errors.name ? 'border-red-400 ring-1 ring-red-400' : ''}`} />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 inset-x-0 bg-card border border-gray-200 rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.name} className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  onClick={() => selectCustomer(s)}>
                  <div>
                    <p className="text-base font-medium">{s.name}</p>
                    {s.phone && <p className="text-xs text-[var(--c-text2)]">{s.phone}</p>}
                  </div>
                  {s.balance !== 0 && (
                    <span className={`text-sm font-bold ${s.balance > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                      {s.balance > 0 ? '+' : ''}{s.balance.toLocaleString()} {t('label.currency')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {errors.name && <p className="text-red-500 text-[13px] mt-1 animate-fade-in">{errors.name}</p>}
        </div>
        {/* Trust info card */}
        {selectedCustomerInfo && (
          <div className="bg-[var(--c-bg)] rounded-2xl p-4 animate-fade-in">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#F4A261] text-white flex items-center justify-center font-heading text-lg font-bold flex-shrink-0">
                {selectedCustomerInfo.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-[15px] text-[var(--c-text)] truncate">{selectedCustomerInfo.name}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getTrustColors(selectedCustomerInfo.trust.label).bg} ${getTrustColors(selectedCustomerInfo.trust.label).text}`}>
                  {selectedCustomerInfo.trust.label === 'new' ? '🆕' : getTrustStars(selectedCustomerInfo.trust.score)} {t(`trust.${selectedCustomerInfo.trust.label}`)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-heading font-bold text-lg ${selectedCustomerInfo.balance > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                  {selectedCustomerInfo.balance.toLocaleString()} {t('label.currency')}
                </p>
                <p className="text-[11px] text-[var(--c-muted)]">{t('trust.current_balance')}</p>
              </div>
              <div className="text-right text-[12px] text-[var(--c-text2)] space-y-0.5">
                <p>{selectedCustomerInfo.creditCount} {t('trust.credits_given')}</p>
                <p>{selectedCustomerInfo.paymentCount} {t('trust.payments_received')}</p>
                <p className={selectedCustomerInfo.overdueCount > 0 ? 'text-[#E76F51] font-medium' : ''}>
                  {selectedCustomerInfo.overdueCount} {t('trust.late_payments')}
                </p>
              </div>
            </div>
            {/* Risky customer warning */}
            {selectedCustomerInfo.trust.score <= 2 && selectedCustomerInfo.trust.label !== 'new' && (
              <div className="mt-3 bg-[#FEF2F2] rounded-xl px-3 py-2.5 flex items-start gap-2">
                <span className="text-sm flex-shrink-0">⚠️</span>
                <p className="text-[13px] text-[#991B1B] font-medium">{t('trust.warning_risky')}</p>
              </div>
            )}
            {/* New customer hint */}
            {selectedCustomerInfo.trust.label === 'new' && (
              <p className="mt-2 text-[12px] text-[var(--c-muted)] text-center">{t('trust.no_history')}</p>
            )}
          </div>
        )}
        <div><label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.customer_phone')}</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" /></div>
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.amount')} ({t('label.currency')}) <span className="text-[#E76F51]">*</span></label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined })); }} className={`input-field ${errors.amount ? 'border-red-400 ring-1 ring-red-400' : ''}`} min={0} />
          {errors.amount && <p className="text-red-500 text-[13px] mt-1 animate-fade-in">{errors.amount}</p>}
        </div>
        <div><label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.description')}</label><input value={desc} onChange={(e) => setDesc(e.target.value)} className="input-field" /></div>
        <DatePicker value={dueDate} onChange={setDueDate} t={t} label={t('label.due_date')} />
        <button ref={submitBtnRef} type="submit" disabled={saving} className="btn w-full h-[52px] bg-[#F4A261] text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40">{saving ? t('label.loading') : t('action.save')}</button>
      </form>
    </div>
  );
}

/* ── Payment sheet ── */
function PaymentSheet({ customerName, customerPhone, currentBalance, t, vendor, enqueue, onClose, onSaved }: {
  customerName: string; customerPhone?: string; currentBalance: number; t: (k: string) => string; vendor: { id: string } | null;
  enqueue: (i: { endpoint: string; method: 'POST' | 'PATCH' | 'DELETE'; body: unknown }) => Promise<void>;
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(''); const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); if (!amount || Number(amount) <= 0) return; setSaving(true);
    const apiPayload = { customer_name: customerName, customer_phone: customerPhone || null, entry_type: 'PAYMENT_RECEIVED', amount };
    const balanceAfter = Math.max(0, currentBalance - Number(amount));
    try {
      // Offline-first
      await putCreditEntrySecure({ id: crypto.randomUUID(), vendor_id: vendor?.id ?? '', customer_name: customerName, customer_phone: customerPhone, entry_type: 'PAYMENT_RECEIVED' as const, amount: Number(amount), balance_after: balanceAfter, reminder_sent: false, created_at: new Date().toISOString() });
      await upsertCustomer(customerName, customerPhone, Number(amount), true, vendor?.id);
      onSaved();
      await enqueue({ endpoint: '/credit', method: 'POST', body: apiPayload });
      if (navigator.onLine) { api.post('/credit', apiPayload).catch(() => {}); }
    } catch (err) { console.error('[Talisman] Payment save failed:', err); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-card rounded-t-3xl px-5 pt-5 pb-8 space-y-4 safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-1"><h3 className="font-heading text-xl font-bold text-primary">{t('action.record_payment')}</h3><button type="button" onClick={onClose} className="p-1.5" aria-label={t('aria.close')}><RiCloseLine className="h-6 w-6 text-gray-400" /></button></div>
        <p className="text-[var(--c-text2)]">{customerName}</p>
        <div><label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.amount')} ({t('label.currency')}) <span className="text-[#E76F51]">*</span></label><input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" min={0} required autoFocus /></div>
        <button type="submit" disabled={saving || !amount} className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40">{saving ? t('label.loading') : t('action.record_payment')}</button>
      </form>
    </div>
  );
}

/* ── Helpers ── */
function groupByCustomer(entries: CreditRecord[]): CustomerBalance[] {
  const map = new Map<string, CreditRecord[]>();
  for (const e of entries) { const arr = map.get(e.customer_name) ?? []; arr.push(e); map.set(e.customer_name, arr); }
  return Array.from(map.entries()).map(([name, entries]) => ({
    customer_name: name, customer_phone: entries.find((e) => e.customer_phone)?.customer_phone ?? null,
    balance: entries.reduce((s, e) => e.entry_type === 'CREDIT_GIVEN' ? s + e.amount : s - e.amount, 0), entries,
  }));
}
function buildSummary(customers: CustomerBalance[]): CreditSummary {
  const today = new Date().toISOString().slice(0, 10); let overdue = 0;
  for (const c of customers) for (const e of c.entries) if (e.entry_type === 'CREDIT_GIVEN' && e.due_date && e.due_date < today) overdue++;
  return { total_outstanding: customers.reduce((s, c) => s + Math.max(0, c.balance), 0), unique_customers: customers.length, overdue_entries: overdue };
}
