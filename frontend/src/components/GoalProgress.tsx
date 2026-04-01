import { useState, useEffect, useCallback } from 'react';
import { RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { getVendorRecords, putInStore, type GoalRecord, type TransactionRecord } from '../services/db';
import { formatCurrency } from '../utils/currency';

interface GoalProgressProps {
  vendorId: string;
  todayRevenue: number;
}

const GOAL_CELEBRATED_KEY = 'tlsm_goal_celebrated';

export default function GoalProgress({ vendorId, todayRevenue }: GoalProgressProps) {
  const { t, locale } = useI18n();
  const [goal, setGoal] = useState<GoalRecord | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const loadGoal = useCallback(async () => {
    const all = await getVendorRecords('goals', vendorId);
    const daily = all.find((g) => g.type === 'daily' && g.is_active);
    setGoal(daily ?? null);
  }, [vendorId]);

  useEffect(() => { loadGoal(); }, [loadGoal]);

  // Celebration check
  useEffect(() => {
    if (!goal || todayRevenue < goal.target_amount) return;
    const today = new Date().toISOString().slice(0, 10);
    const celebKey = `${GOAL_CELEBRATED_KEY}_${today}`;
    if (localStorage.getItem(celebKey)) { setCelebrated(true); return; }
    // First time hitting goal today!
    localStorage.setItem(celebKey, '1');
    setCelebrated(true);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, [goal, todayRevenue]);

  if (!goal && !showEditor) {
    return (
      <button type="button" onClick={() => setShowEditor(true)}
        className="card p-4 w-full text-left flex items-center gap-3 hover:shadow-md transition-shadow">
        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-lg">🎯</div>
        <div>
          <p className="font-heading font-bold text-sm text-[var(--c-text)]">{t('goals.set')}</p>
          <p className="text-[12px] text-[var(--c-muted)]">{t('goals.daily')}</p>
        </div>
      </button>
    );
  }

  if (showEditor) {
    return (
      <GoalEditor
        vendorId={vendorId}
        existing={goal}
        t={t}
        locale={locale}
        onSave={async (g) => {
          await putInStore('goals', g);
          setShowEditor(false);
          loadGoal();
        }}
        onClose={() => setShowEditor(false)}
      />
    );
  }

  const target = goal!.target_amount;
  const pct = Math.min(Math.round((todayRevenue / target) * 100), 100);
  const remaining = Math.max(0, target - todayRevenue);
  const exceeded = todayRevenue >= target;

  const getMessage = () => {
    if (exceeded) return t('goals.msg_100');
    if (pct >= 75) return t('goals.msg_75').replace('{amount}', remaining.toLocaleString());
    if (pct >= 50) return t('goals.msg_50');
    if (pct >= 25) return t('goals.msg_25');
    return t('goals.msg_0');
  };

  return (
    <div className="card p-4 space-y-3 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * -50}%`,
                width: 8, height: 8,
                background: ['#2D6A4F', '#F4A261', '#E76F51', '#3B82F6', '#FFD166'][i % 5],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animation: `confetti-fall ${1.5 + Math.random()}s ease-out forwards`,
                animationDelay: `${Math.random() * 0.5}s`,
              }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="font-heading font-bold text-[14px] text-[var(--c-text)]">{t('goals.daily')}</span>
        </div>
        <button type="button" onClick={() => setShowEditor(true)}
          className="text-[11px] font-medium text-[var(--c-primary)]">{t('action.edit')}</button>
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${exceeded ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-[#1B4332] to-[#40916C]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <p className="text-[13px] font-bold text-[var(--c-text)]">
            {formatCurrency(todayRevenue, locale)} <span className="font-normal text-[var(--c-muted)]">{t('goals.of')} {formatCurrency(target, locale)}</span>
          </p>
          <span className={`text-[13px] font-extrabold ${exceeded ? 'text-emerald-600' : 'text-[var(--c-primary)]'}`}>
            {pct}% {exceeded ? '🎉' : ''}
          </span>
        </div>
      </div>

      {/* Motivational message */}
      <p className={`text-[13px] font-medium ${exceeded ? 'text-emerald-600' : 'text-[var(--c-text2)]'}`}>
        {getMessage()}
      </p>
    </div>
  );
}

/* ── Goal Editor ── */
function GoalEditor({ vendorId, existing, t, locale, onSave, onClose }: {
  vendorId: string; existing: GoalRecord | null;
  t: (k: string) => string; locale: string;
  onSave: (g: GoalRecord) => void; onClose: () => void;
}) {
  const [daily, setDaily] = useState(existing?.target_amount?.toString() ?? '');
  const [weekly, setWeekly] = useState('');
  const [monthly, setMonthly] = useState('');
  const [suggestion, setSuggestion] = useState<{ avg: number; target: number } | null>(null);

  // Compute last week's average revenue for smart suggestion
  useEffect(() => {
    getVendorRecords('transactions', vendorId).then((all: TransactionRecord[]) => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAgoStr = weekAgo.toISOString().slice(0, 10);
      const lastWeekSales = all.filter(
        (tx) => tx.transaction_type === 'SALE' && (tx.created_at ?? '') >= weekAgoStr
      );
      if (lastWeekSales.length === 0) return;
      const totalRevenue = lastWeekSales.reduce((s, tx) => s + Number(tx.total_amount), 0);
      const avg = Math.round(totalRevenue / 7);
      if (avg > 0) {
        const target = Math.round(avg * 1.2 / 100) * 100; // 20% higher, rounded to nearest 100
        setSuggestion({ avg, target });
      }
    });
  }, [vendorId]);

  // Auto-calculate from daily
  useEffect(() => {
    const d = Number(daily) || 0;
    if (d > 0 && !weekly) setWeekly(String(d * 6));
    if (d > 0 && !monthly) setMonthly(String(d * 26));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!daily || Number(daily) <= 0) return;
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      vendor_id: vendorId,
      type: 'daily',
      target_amount: Number(daily),
      is_active: true,
      created_at: existing?.created_at ?? new Date().toISOString(),
    });
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-[15px] text-[var(--c-text)] flex items-center gap-2">
          🎯 {t('goals.title')}
        </h3>
        <button type="button" onClick={onClose}
          className="h-7 w-7 rounded-full flex items-center justify-center text-[var(--c-text2)] hover:bg-[var(--c-bg)]">
          <RiCloseLine className="h-4 w-4" />
        </button>
      </div>

      {/* Smart suggestion */}
      {suggestion && !daily && (
        <button type="button" onClick={() => setDaily(String(suggestion.target))}
          className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-[13px] text-amber-800 hover:bg-amber-100 transition-colors">
          <span className="font-bold">💡 </span>
          {t('goals.suggestion')
            .replace('{avg}', suggestion.avg.toLocaleString())
            .replace('{target}', suggestion.target.toLocaleString())}
        </button>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-[12px] font-bold text-[var(--c-text2)] mb-1 uppercase tracking-wider">{t('goals.daily')} (G)</label>
          <input type="number" inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)}
            className="input-field text-lg font-heading font-bold text-right" placeholder="5,000" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-bold text-[var(--c-text2)] mb-1 uppercase tracking-wider">{t('goals.weekly')}</label>
            <input type="number" inputMode="numeric" value={weekly} onChange={(e) => setWeekly(e.target.value)}
              className="input-field text-sm font-bold text-right text-[var(--c-muted)]" placeholder="30,000" />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[var(--c-text2)] mb-1 uppercase tracking-wider">{t('goals.monthly')}</label>
            <input type="number" inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value)}
              className="input-field text-sm font-bold text-right text-[var(--c-muted)]" placeholder="120,000" />
          </div>
        </div>
      </div>

      <button type="button" onClick={handleSave} disabled={!daily || Number(daily) <= 0}
        className="btn w-full h-11 rounded-xl gradient-primary text-white font-heading font-bold text-sm shadow-sm disabled:opacity-40">
        {t('goals.save')}
      </button>
    </div>
  );
}
