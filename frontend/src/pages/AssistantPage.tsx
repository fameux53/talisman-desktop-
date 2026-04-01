import { useState, useEffect, useCallback } from 'react';
import { RiSettings3Line, RiCloseLine, RiCheckLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { generateInsights, getApiKey, saveApiKey, type Insight } from '../services/insightEngine';
import SmartInsights from '../components/SmartInsights';
import AIChat, { AIPromoCard } from '../components/AIChat';
import Toast from '../components/Toast';

export default function AssistantPage() {
  const { t, locale } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [storedKey, setStoredKey] = useState(() => getApiKey(vendorId));
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [toast, setToast] = useState('');

  const loadInsights = useCallback(async () => {
    if (!vendorId) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await generateInsights(vendorId, locale, t);
      setInsights(result);
    } catch (err) {
      console.error('Failed to generate insights:', err);
    } finally {
      setLoading(false);
    }
  }, [vendorId, locale, t]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  const handleSaveKey = () => {
    const trimmed = keyInput.trim();
    saveApiKey(trimmed, vendorId);
    setStoredKey(trimmed || null);
    setShowKeyInput(false);
    setKeyInput('');
    if (trimmed) {
      setToast(t('assistant.ai_active'));
    } else {
      setToast(t('assistant.key_removed'));
    }
    setTimeout(() => setToast(''), 2500);
  };

  const handleRemoveKey = () => {
    saveApiKey('', vendorId);
    setStoredKey(null);
    setToast(t('assistant.key_removed'));
    setTimeout(() => setToast(''), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-up pb-20 md:pb-4">
      <Toast msg={toast} />

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold text-[var(--c-text)] flex items-center gap-2">
          🧠 {t('assistant.title')}
        </h1>
        <div className="flex items-center gap-2">
          {storedKey && (
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
              <RiCheckLine className="h-3 w-3" /> {t('assistant.ai_active')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--c-text2)] hover:bg-gray-50 transition-colors"
          >
            <RiSettings3Line className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* API Key Settings (collapsible) */}
      {showKeyInput && (
        <div className="card p-4 space-y-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white text-lg">🤖</div>
            <div className="flex-1">
              <h3 className="text-[14px] font-bold text-[var(--c-text)]">{t('assistant.ai_settings_title')}</h3>
              <p className="text-[12px] text-[var(--c-text2)]">{t('assistant.ai_settings_desc')}</p>
            </div>
            <button type="button" onClick={() => setShowKeyInput(false)} className="text-[var(--c-text2)]">
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          <div>
            <label className="text-[13px] font-bold text-[var(--c-text2)] mb-1 block">{t('assistant.api_key')}</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder={storedKey ? '••••••••••' : 'sk-ant-...'}
                className="input-field flex-1 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={handleSaveKey}
                className="px-4 h-12 gradient-primary text-white rounded-xl font-bold text-[13px] active:scale-95 transition-transform"
              >
                {t('assistant.save')}
              </button>
            </div>
            <p className="text-[11px] text-[var(--c-muted)] mt-2">{t('assistant.api_key_help')}</p>
          </div>

          {storedKey && (
            <button
              type="button"
              onClick={handleRemoveKey}
              className="text-[12px] text-red-500 font-medium"
            >
              {t('assistant.key_removed')}
            </button>
          )}
        </div>
      )}

      {/* MODE 1 — Free Smart Insights (always visible) */}
      <SmartInsights insights={insights} loading={loading} />

      {/* MODE 2 — AI Chat (only if API key is set) */}
      {storedKey ? (
        <AIChat vendorId={vendorId} apiKey={storedKey} />
      ) : (
        <AIPromoCard />
      )}
    </div>
  );
}
