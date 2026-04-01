import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { RiArrowLeftLine, RiAlertFill, RiAddLine, RiCloseLine, RiArrowRightSLine, RiHandCoinLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import Toast from '../components/Toast';
import DatePicker from '../components/DatePicker';
import api from '../services/api';
import { getAllFromStore, putInStore, upsertCustomer, type CreditRecord, type CustomerRecord } from '../services/db';
import { putCreditEntrySecure, getAllCreditEntriesSecure, getAllCustomersSecure } from '../services/secureDb';

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
  const [customerSearch, setCustomerSearch] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const [cRes, sRes] = await Promise.all([api.get<CustomerBalance[]>('/credit'), api.get<CreditSummary>('/credit/summary')]);
        setCustomers(cRes.data); setSummary(sRes.data);
        for (const c of cRes.data) for (const e of c.entries) await putInStore('creditEntries', e);
      } else {
        const all = await getAllCreditEntriesSecure();
        const grouped = groupByCustomer(all); setCustomers(grouped); setSummary(buildSummary(grouped));
      }
    } catch { const all = await getAllCreditEntriesSecure(); const g = groupByCustomer(all); setCustomers(g); setSummary(buildSummary(g)); }
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

  // ── Detail view ──
  if (selectedCustomer && detail) {
    const hasOverdue = detail.entries.some((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && new Date(e.due_date) < new Date());
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4 animate-fade-up">
        <Toast msg={toast} />
        <button type="button" onClick={() => setSelectedCustomer(null)} className="flex items-center gap-1 text-[var(--c-primary)] font-medium h-12">
          <RiArrowLeftLine className="h-5 w-5" /> {t('action.back')}
        </button>
        <div className="card p-5 text-center">
          {/* Avatar */}
          <div className="mx-auto w-14 h-14 rounded-full bg-[#F4A261] text-white flex items-center justify-center font-heading text-2xl font-bold mb-2">
            {detail.customer_name.charAt(0)}
          </div>
          <p className="font-heading text-xl font-bold">{detail.customer_name}</p>
          {detail.customer_phone && <p className="text-sm text-[var(--c-text2)]">{detail.customer_phone}</p>}
          <p className={`font-heading text-3xl font-extrabold mt-2 ${hasOverdue ? 'text-[#E76F51]' : Number(detail.balance) > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
            {Number(detail.balance).toLocaleString()} {t('label.currency')}
          </p>
          <p className="text-xs text-[var(--c-text2)] mt-0.5">{t('label.balance')}</p>
        </div>
        <button type="button" onClick={() => setSheetMode('payment')}
          className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md">
          {t('action.record_payment')}
        </button>
        <h3 className="font-heading font-bold text-lg text-[var(--c-text)] mb-3">{t('label.ledger')}</h3>
        {/* Timeline */}
        <div className="relative pl-5">
          <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-200" />
          {detail.entries.map((entry) => {
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
        {sheetMode === 'payment' && (
          <PaymentSheet customerName={detail.customer_name} customerPhone={detail.customer_phone ?? undefined} t={t} vendor={vendor} enqueue={enqueue}
            onClose={() => setSheetMode(null)} onSaved={() => { setSheetMode(null); showToast(t('message.payment_recorded')); refresh(); }} />
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4 animate-fade-up">
      <Toast msg={toast} />
      {/* Summary banner */}
      <div className="gradient-primary rounded-2xl p-4 text-white">
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
        <div className="space-y-4">
          {/* Onboarding card */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#F4A261]/15 flex items-center justify-center">
                <RiHandCoinLine className="h-5 w-5 text-[#F4A261]" />
              </div>
              <h3 className="font-heading font-bold text-base text-[var(--c-text)]">{t('credit.onboarding_title')}</h3>
            </div>
            <p className="text-sm text-[var(--c-text2)] leading-relaxed">{t('credit.onboarding_body')}</p>
            <button
              type="button"
              onClick={() => setSheetMode('credit')}
              className="btn w-full h-12 rounded-xl bg-[#F4A261] text-white font-heading font-bold text-base shadow-md gap-2"
            >
              <RiAddLine className="h-5 w-5" />
              {t('credit.first_cta')}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((c) => {
            const hasOverdue = c.entries.some((e) => e.entry_type === 'CREDIT_GIVEN' && e.due_date && new Date(e.due_date) < new Date());
            return (
              <div key={c.customer_name} onClick={() => setSelectedCustomer(c.customer_name)}
                className="card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer" role="button" tabIndex={0}>
                <div className="w-11 h-11 rounded-full gradient-teal text-white flex items-center justify-center font-heading text-lg font-bold flex-shrink-0">
                  {c.customer_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-semibold text-lg truncate">{c.customer_name}</p>
                  <p className="text-xs text-[var(--c-text2)]">{c.entries.length} {t('label.entries')}</p>
                </div>
                <div className="text-right flex items-center gap-1.5">
                  <div>
                    <p className={`font-heading font-bold text-xl ${hasOverdue ? 'text-[#E76F51]' : Number(c.balance) > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                      {Number(c.balance).toLocaleString()} {t('label.currency')}
                    </p>
                    {hasOverdue && <span className="text-[10px] bg-[#E76F51]/10 text-[#E76F51] px-2 py-0.5 rounded-full font-bold">{t('label.overdue')}</span>}
                  </div>
                  <RiArrowRightSLine className="h-5 w-5 text-gray-300 flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" onClick={() => setSheetMode('credit')}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-[#F4A261] text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40">
        <RiAddLine className="h-7 w-7" />
      </button>

      {sheetMode === 'credit' && (
        <CreditSheet customerNames={customerNames} t={t} vendor={vendor} enqueue={enqueue}
          onClose={() => setSheetMode(null)} onSaved={() => { setSheetMode(null); showToast(t('message.credit_recorded')); refresh(); }} />
      )}
    </div>
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
  const handleNameChange = async (v: string) => {
    setName(v);
    if (v.length < 2) { setSuggestions([]); return; }
    const q = v.toLowerCase();
    // Load from customers store for richer suggestions
    try {
      const allCustomers = await getAllCustomersSecure();
      const matches = allCustomers
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((c) => ({ name: c.name, phone: c.phone, balance: c.balance }));
      if (matches.length > 0) { setSuggestions(matches); return; }
    } catch { /* fallback to simple names */ }
    setSuggestions(customerNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 5).map((n) => ({ name: n, balance: 0 })));
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
      const localEntry = { id: crypto.randomUUID(), vendor_id: vendor?.id ?? '', customer_name: name, customer_phone: phone || undefined, entry_type: 'CREDIT_GIVEN' as const, amount: Number(amount), balance_after: Number(amount), description: desc || undefined, due_date: dueDate || undefined, reminder_sent: false };
      await putCreditEntrySecure(localEntry);
      await upsertCustomer(name, phone || undefined, Number(amount), false);
      onSaved();
      await enqueue({ endpoint: '/credit', method: 'POST', body: apiPayload });
      if (navigator.onLine) { api.post('/credit', apiPayload).catch(() => {}); }
    } catch (err) { console.error('[MarketMama] Credit save failed:', err); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-1"><h3 className="font-heading text-xl font-bold">{t('action.new_credit')}</h3><button type="button" onClick={onClose} className="p-1.5" aria-label={t('aria.close')}><RiCloseLine className="h-6 w-6 text-gray-400" /></button></div>
        <div className="relative">
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.customer_name')} <span className="text-[#E76F51]">*</span></label>
          <input value={name} onChange={(e) => { handleNameChange(e.target.value); if (errors.name) setErrors((prev) => ({ ...prev, name: undefined })); }} className={`input-field ${errors.name ? 'border-red-400 ring-1 ring-red-400' : ''}`} />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 inset-x-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.name} className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  onClick={() => { setName(s.name); if (s.phone) setPhone(s.phone); setSuggestions([]); setErrors((prev) => ({ ...prev, name: undefined })); }}>
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
function PaymentSheet({ customerName, customerPhone, t, vendor, enqueue, onClose, onSaved }: {
  customerName: string; customerPhone?: string; t: (k: string) => string; vendor: { id: string } | null;
  enqueue: (i: { endpoint: string; method: 'POST' | 'PATCH' | 'DELETE'; body: unknown }) => Promise<void>;
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(''); const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); if (!amount || Number(amount) <= 0) return; setSaving(true);
    const apiPayload = { customer_name: customerName, customer_phone: customerPhone || null, entry_type: 'PAYMENT_RECEIVED', amount };
    try {
      // Offline-first
      await putCreditEntrySecure({ id: crypto.randomUUID(), vendor_id: vendor?.id ?? '', customer_name: customerName, customer_phone: customerPhone, entry_type: 'PAYMENT_RECEIVED' as const, amount: Number(amount), balance_after: 0, reminder_sent: false });
      await upsertCustomer(customerName, customerPhone, Number(amount), true);
      onSaved();
      await enqueue({ endpoint: '/credit', method: 'POST', body: apiPayload });
      if (navigator.onLine) { api.post('/credit', apiPayload).catch(() => {}); }
    } catch (err) { console.error('[MarketMama] Payment save failed:', err); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-1"><h3 className="font-heading text-xl font-bold">{t('action.record_payment')}</h3><button type="button" onClick={onClose} className="p-1.5" aria-label={t('aria.close')}><RiCloseLine className="h-6 w-6 text-gray-400" /></button></div>
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
