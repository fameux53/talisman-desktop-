import { useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import LanguageSelector from '../components/LanguageSelector';
import api from '../services/api';

export default function AuthPage() {
  const { t } = useI18n();
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        await api.post('/auth/register', {
          phone_number: phone,
          display_name: displayName || phone,
          pin,
          preferred_language: 'HT',
        });
        // Auto-login after registration
        await login(phone, pin);
      } else {
        await login(phone, pin);
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError(t('auth.error_conflict'));
      } else if (status === 401 || status === 423) {
        setError(t('auth.error_invalid'));
      } else {
        // Offline or network error — for offline-first, allow local-only mode
        setError(t('auth.error_invalid'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col">
      {/* Header */}
      <div className="gradient-primary px-5 pt-10 pb-12 text-white text-center">
        <p className="text-3xl mb-1">🛍️</p>
        <h1 className="font-heading text-3xl font-extrabold">MarketMama</h1>
        <p className="text-white/70 text-sm mt-1">{t('app.tagline')}</p>
        <div className="mt-4 flex justify-center">
          <LanguageSelector />
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 -mt-6 max-w-[400px] w-full mx-auto">
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="font-heading text-xl font-bold text-center text-[var(--c-text)]">
            {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
          </h2>

          {/* Display name (register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.display_name')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
                placeholder="Marie Jean"
                required
              />
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.phone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              className={`input-field ${error ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="+509 3700 1234"
              required
            />
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.pin')}</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              className={`input-field text-center text-2xl tracking-[0.5em] ${error ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="••••"
              minLength={4}
              maxLength={6}
              required
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm text-center animate-fade-in">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !phone || pin.length < 4}
            className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40"
          >
            {loading ? t('label.loading') : mode === 'login' ? t('auth.login_btn') : t('auth.register_btn')}
          </button>

          {/* Toggle */}
          <p className="text-center text-sm text-[var(--c-text2)]">
            {mode === 'login' ? t('auth.no_account') : t('auth.has_account')}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-[var(--c-primary)] font-bold"
            >
              {mode === 'login' ? t('auth.register_title') : t('auth.login_title')}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
