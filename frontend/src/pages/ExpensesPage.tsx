import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { RiAddLine, RiDeleteBinLine, RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { getVendorRecords, putInStore, deleteFromStore, type ExpenseRecord, type ExpenseCategory } from '../services/db';
import { formatCurrency } from '../utils/currency';
import Toast from '../components/Toast';

const CATEGORIES: { key: ExpenseCategory; emoji: string }[] = [
  { key: 'rent', emoji: '🏠' },
  { key: 'transport', emoji: '🚐' },
  { key: 'phone', emoji: '📱' },
  { key: 'salary', emoji: '💰' },
  { key: 'fuel', emoji: '⛽' },
  { key: 'supplies', emoji: '🛒' },
  { key: 'other', emoji: '📋' },
];

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const { t, locale } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const all = await getVendorRecords('expenses', vendorId);
      all.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
      setExpenses(all);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Escape key closes topmost modal (delete confirm > form)
  useEffect(() => {
    if (!deleteConfirm) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDeleteConfirm(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteConfirm]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleSave = async (exp: ExpenseRecord) => {
    await putInStore('expenses', exp);
    setShowForm(false);
    showToast(t('expenses.saved'));
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteFromStore('expenses', id);
    setDeleteConfirm(null);
    showToast(t('expenses.deleted'));
    refresh();
  };

  // Monthly summary
  const monthStart = startOfMonth();
  const monthExpenses = expenses.filter((e) => e.date >= monthStart);
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = CATEGORIES.map(({ key, emoji }) => {
    const catTotal = monthExpenses.filter((e) => e.category === key).reduce((s, e) => s + e.amount, 0);
    return { key, emoji, total: catTotal, pct: monthTotal > 0 ? Math.round((catTotal / monthTotal) * 100) : 0 };
  }).filter((c) => c.total > 0);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-up">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-32 w-full" />
        <div className="skeleton h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold text-[var(--c-text)]">💸 {t('expenses.title')}</h1>
        <button type="button" onClick={() => setShowForm(true)}
          className="btn h-10 px-4 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 shadow-sm">
          <RiAddLine className="h-4 w-4" /> {t('expenses.new')}
        </button>
      </div>

      {/* Monthly summary card */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--c-text2)]">{t('expenses.total_month')}</p>
          <p className="font-heading text-2xl font-extrabold text-[#E76F51]">{formatCurrency(monthTotal, locale)}</p>
        </div>
        {byCategory.length > 0 && (
          <div className="space-y-2">
            {byCategory.map(({ key, emoji, total, pct }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center">{emoji}</span>
                <span className="text-sm font-medium flex-1 text-[var(--c-text)]">{t(`expenses.cat_${key}`)}</span>
                <span className="text-sm font-bold text-[var(--c-text)]">{formatCurrency(total, locale)}</span>
                <span className="text-[11px] text-[var(--c-muted)] w-10 text-right">({pct}%)</span>
                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#E76F51]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent expenses list */}
      <div>
        <h2 className="font-heading font-bold text-[15px] text-[var(--c-text)] mb-3">{t('expenses.recent')}</h2>
        {expenses.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <p className="text-4xl">💸</p>
            <p className="text-[var(--c-text2)]">{t('expenses.empty')}</p>
            <button type="button" onClick={() => setShowForm(true)}
              className="btn h-10 px-5 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 mx-auto">
              <RiAddLine className="h-4 w-4" /> {t('expenses.new')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.slice(0, 20).map((exp) => {
              const cat = CATEGORIES.find((c) => c.key === exp.category);
              return (
                <div key={exp.id} className="card p-3.5 flex items-center gap-3 group">
                  <span className="text-xl w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">{cat?.emoji ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--c-text)] truncate">
                      {exp.description || t(`expenses.cat_${exp.category}`)}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--c-muted)]">
                      <span>{formatDate(exp.date)}</span>
                      <span>•</span>
                      <span>{t(`expenses.cat_${exp.category}`)}</span>
                      {exp.is_recurring && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">🔄 {t(`expenses.${exp.recurrence}`)}</span>}
                    </div>
                  </div>
                  <p className="font-heading font-extrabold text-base text-[#E76F51] flex-shrink-0">{formatCurrency(exp.amount, locale)}</p>
                  <button type="button" onClick={() => setDeleteConfirm(exp.id)}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[var(--c-text2)] opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-[#E76F51] transition-all flex-shrink-0">
                    <RiDeleteBinLine className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add expense form */}
      {showForm && (
        <ExpenseForm t={t} vendorId={vendorId} onSave={handleSave} onClose={() => setShowForm(false)} />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-[300px] w-full mx-4 animate-fade-up shadow-2xl space-y-4">
            <p className="font-heading font-bold text-lg text-center text-[var(--c-text)]">{t('expenses.delete_confirm')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-sm text-[var(--c-text2)]">{t('action.cancel')}</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-11 rounded-xl bg-[#E76F51] text-white font-bold text-sm">{t('notes.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Expense Form ── */
function ExpenseForm({ t, vendorId, onSave, onClose }: {
  t: (k: string) => string; vendorId: string;
  onSave: (exp: ExpenseRecord) => void; onClose: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('transport');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly'>('monthly');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    onSave({
      id: crypto.randomUUID(),
      vendor_id: vendorId,
      category,
      amount: Number(amount),
      description: description.trim() || null,
      date,
      is_recurring: isRecurring,
      recurrence: isRecurring ? recurrence : null,
      employee_id: null,
      location_id: null,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl animate-slide-up md:relative md:z-10 md:rounded-3xl md:w-full md:max-w-[440px] md:max-h-[90vh] md:overflow-y-auto md:animate-fade-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="font-heading text-lg font-bold text-[var(--c-text)]">💸 {t('expenses.new')}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--c-text2)] hover:bg-gray-50">
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-6 space-y-4">
          {/* Category picker */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-2">{t('expenses.category')}</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(({ key, emoji }) => (
                <button key={key} type="button" onClick={() => setCategory(key)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                    category === key ? 'border-[#E76F51] bg-orange-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                  <span className="text-xl">{emoji}</span>
                  <span className="text-[10px] font-medium text-[var(--c-text)] leading-tight text-center">{t(`expenses.cat_${key}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('expenses.amount')} (HTG)</label>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="input-field text-xl font-heading font-bold text-right" placeholder="0" autoFocus required />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('expenses.description')}</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="input-field" placeholder="Tap-tap Pétionville..." />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('expenses.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--c-text)]">{t('expenses.recurring')}</span>
            <button type="button" onClick={() => setIsRecurring(!isRecurring)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center ${isRecurring ? 'bg-[var(--c-primary)] justify-end' : 'bg-gray-200 justify-start'}`}>
              <div className="w-5 h-5 bg-white rounded-full shadow-sm mx-0.5" />
            </button>
          </div>
          {isRecurring && (
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRecurrence(r)}
                  className={`flex-1 h-9 rounded-xl text-xs font-bold transition-colors ${
                    recurrence === r ? 'bg-[var(--c-primary)] text-white' : 'bg-gray-50 text-[var(--c-text2)]'
                  }`}>
                  {t(`expenses.${r}`)}
                </button>
              ))}
            </div>
          )}

          <button type="submit" disabled={!amount || Number(amount) <= 0}
            className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md disabled:opacity-40">
            {t('expenses.new')}
          </button>
        </form>
      </div>
    </div>
  );
}
