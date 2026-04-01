import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { RiGiftLine, RiAddLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import {
  getVendorRecords, putInStore,
  type LoyaltyProgramRecord, type LoyaltyCardRecord,
} from '../services/db';
import Toast from '../components/Toast';

export default function LoyaltyPage() {
  const { t } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [program, setProgram] = useState<LoyaltyProgramRecord | null>(null);
  const [cards, setCards] = useState<LoyaltyCardRecord[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    const programs = await getVendorRecords('loyaltyPrograms', vendorId);
    const active = programs.find((p) => p.is_active) ?? null;
    setProgram(active);
    if (active) {
      const allCards = await getVendorRecords('loyaltyCards', vendorId);
      setCards(allCards.filter((c) => c.program_id === active.id).sort((a, b) => b.stamps - a.stamps));
    }
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleSaveProgram = async (prog: LoyaltyProgramRecord) => {
    // Deactivate existing programs
    const existing = await getVendorRecords('loyaltyPrograms', vendorId);
    for (const p of existing) {
      if (p.id !== prog.id) await putInStore('loyaltyPrograms', { ...p, is_active: false });
    }
    await putInStore('loyaltyPrograms', prog);
    setShowSetup(false);
    showToast(t('loyalty.saved'));
    refresh();
  };

  const handleGiveReward = async (card: LoyaltyCardRecord) => {
    await putInStore('loyaltyCards', {
      ...card,
      stamps: 0,
      rewards_earned: card.rewards_earned + 1,
      last_stamp_date: new Date().toISOString(),
    });
    showToast(t('loyalty.reward_given'));
    refresh();
  };

  const handleToggle = async () => {
    if (!program) return;
    await putInStore('loyaltyPrograms', { ...program, is_active: !program.is_active });
    showToast(program.is_active ? t('loyalty.deactivate') : t('loyalty.activate'));
    refresh();
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold text-primary">🎁 {t('loyalty.title')}</h1>
        <button type="button" onClick={() => setShowSetup(true)}
          className="btn h-10 px-4 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 shadow-sm">
          {program ? t('action.edit') : t('loyalty.activate')}
        </button>
      </div>

      {/* Program info card */}
      {program ? (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">🎁</div>
              <div>
                <p className="font-heading font-bold text-[15px] text-primary">{program.name}</p>
                <p className="text-[13px] text-secondary">{program.reward_description}</p>
              </div>
            </div>
            <button type="button" onClick={handleToggle}
              className={`h-8 px-3 rounded-lg text-xs font-bold ${program.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {program.is_active ? t('employees.active') : t('employees.inactive')}
            </button>
          </div>

          {/* Customer stamp cards */}
          {cards.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--c-border)]">
              {cards.map((card) => {
                const rewardReady = card.stamps >= program.required_purchases;
                return (
                  <div key={card.id} className="flex items-center gap-3 py-2">
                    <div className="w-9 h-9 rounded-full bg-page flex items-center justify-center font-heading font-bold text-sm text-primary">
                      {card.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary truncate">{card.customer_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {Array.from({ length: program.required_purchases }).map((_, i) => (
                          <div key={i} className={`w-3 h-3 rounded-full ${i < card.stamps ? 'bg-[var(--c-primary)]' : 'bg-gray-200'}`} />
                        ))}
                        <span className="text-[11px] text-muted ml-1">
                          {t('loyalty.stamps').replace('{current}', String(card.stamps)).replace('{total}', String(program.required_purchases))}
                        </span>
                      </div>
                      {card.rewards_earned > 0 && (
                        <p className="text-[10px] text-amber-600 mt-0.5">⭐ {t('loyalty.earned_total').replace('{count}', String(card.rewards_earned))}</p>
                      )}
                    </div>
                    {rewardReady ? (
                      <button type="button" onClick={() => handleGiveReward(card)}
                        className="h-8 px-3 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold animate-pulse">
                        🎁 {t('loyalty.give_reward')}
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted">
                        {t('loyalty.remaining').replace('{count}', String(program.required_purchases - card.stamps))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {cards.length === 0 && (
            <p className="text-[13px] text-muted text-center py-4">
              {t('loyalty.no_program')}
            </p>
          )}
        </div>
      ) : (
        <div className="card p-10 text-center space-y-3">
          <p className="text-4xl">🎁</p>
          <p className="text-secondary">{t('loyalty.no_program')}</p>
          <button type="button" onClick={() => setShowSetup(true)}
            className="btn h-10 px-5 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 mx-auto">
            <RiAddLine className="h-4 w-4" /> {t('loyalty.activate')}
          </button>
        </div>
      )}

      {/* Setup form */}
      {showSetup && (
        <LoyaltySetupForm
          t={t}
          vendorId={vendorId}
          existing={program}
          onSave={handleSaveProgram}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}

function LoyaltySetupForm({ t, vendorId, existing, onSave, onClose }: {
  t: (k: string) => string; vendorId: string;
  existing: LoyaltyProgramRecord | null;
  onSave: (p: LoyaltyProgramRecord) => void; onClose: () => void;
}) {
  const [purchases, setPurchases] = useState(existing?.required_purchases?.toString() ?? '10');
  const [reward, setReward] = useState(existing?.reward_description ?? '');
  const [rewardValue, setRewardValue] = useState(existing?.reward_value?.toString() ?? '');
  const [name, setName] = useState(existing?.name ?? '');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Auto-generate name
  useEffect(() => {
    if (purchases && reward && !existing) {
      setName(`Achte ${purchases}, jwenn: ${reward}`);
    }
  }, [purchases, reward, existing]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!purchases || !reward.trim()) return;
    onSave({
      id: existing?.id ?? crypto.randomUUID(),
      vendor_id: vendorId,
      name: name || `Achte ${purchases}, jwenn rekonpans`,
      required_purchases: Number(purchases),
      reward_description: reward.trim(),
      reward_value: Number(rewardValue) || 0,
      is_active: true,
      created_at: existing?.created_at ?? new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl animate-slide-up md:relative md:z-10 md:rounded-3xl md:w-full md:max-w-[420px] md:max-h-[90vh] md:overflow-y-auto md:animate-fade-up"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
        <form onSubmit={handleSubmit} className="px-5 pb-6 pt-3 space-y-4">
          <h3 className="font-heading text-lg font-bold text-primary">🎁 {t('loyalty.title')}</h3>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">{t('loyalty.after_purchases')}</label>
            <input type="number" inputMode="numeric" value={purchases} onChange={(e) => setPurchases(e.target.value)}
              className="input-field text-xl font-heading font-bold text-center" min={2} max={50} />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">{t('loyalty.reward')}</label>
            <input type="text" value={reward} onChange={(e) => setReward(e.target.value)}
              className="input-field" placeholder="1 mamit diri gratis" />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">{t('loyalty.reward_value')}</label>
            <input type="number" inputMode="numeric" value={rewardValue} onChange={(e) => setRewardValue(e.target.value)}
              className="input-field" placeholder="250" />
          </div>

          <button type="submit" disabled={!purchases || !reward.trim()}
            className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md disabled:opacity-40">
            {t('loyalty.activate')}
          </button>
        </form>
      </div>
    </div>
  );
}
