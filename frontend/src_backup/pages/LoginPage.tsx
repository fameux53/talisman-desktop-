import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import LanguageSelector from '../components/LanguageSelector';
import PhoneInput from '../components/PhoneInput';

export default function LoginPage() {
  const { t } = useI18n();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const [phone, setPhone] = useState('+509');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState('');

  const localDigits = phone.startsWith('+509') ? phone.slice(4) : '';
  const canSubmit = localDigits.length === 8 && pin.length === 6;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorKey('');
    setLoading(true);
    try {
      await login(phone, pin);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number } })?.response;
      if (!resp) {
        setErrorKey('auth.error_network');
      } else if (resp.status === 423) {
        setErrorKey('auth.error_locked');
      } else if (resp.status === 401) {
        setErrorKey('auth.error_invalid');
      } else if (resp.status === 429) {
        setErrorKey('auth.error_rate_limit');
      } else if (resp.status && resp.status >= 500) {
        setErrorKey('auth.error_server');
      } else {
        setErrorKey('auth.error_unknown');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col">
      <div className="absolute top-4 right-4 z-10"><LanguageSelector /></div>

      <div className="gradient-primary px-5 pt-12 pb-14 text-white text-center">
        <p className="text-4xl mb-2">🛍️</p>
        <h1 className="font-heading text-3xl font-extrabold">MarketMama</h1>
        <p className="text-white/70 text-sm mt-1.5 max-w-[280px] mx-auto">{t('app.tagline')}</p>
      </div>

      <div className="flex-1 px-5 -mt-6 max-w-[400px] w-full mx-auto">
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <h2 className="font-heading text-xl font-bold text-center text-[var(--c-text)]">
            {t('auth.login_title')}
          </h2>

          <div>
            <label htmlFor="login-phone" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.phone')}</label>
            <PhoneInput
              id="login-phone"
              name="phone"
              value={phone}
              onChange={(v) => { setPhone(v); setErrorKey(''); }}
              error={!!errorKey}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="login-pin" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.pin')}</label>
            <input id="login-pin" name="pin" type="password" inputMode="numeric" autoComplete="off"
              value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrorKey(''); }}
              className={`input-field text-center text-2xl tracking-[0.5em] ${errorKey ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="••••••" minLength={6} maxLength={6} required
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-[#6B7280]">{t('auth.pin_helper')}</span>
              <span className={`text-xs font-medium ${pin.length === 6 ? 'text-emerald-600' : 'text-[#6B7280]'}`}>{pin.length}/6</span>
            </div>
          </div>

          {errorKey && <p className="text-red-500 text-sm text-center animate-fade-in">{t(errorKey)}</p>}

          <button type="submit" disabled={loading || !canSubmit}
            className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40">
            {loading ? t('auth.logging_in') : t('auth.login_btn')}
          </button>

          <p className="text-center text-sm text-[var(--c-text2)]">
            {t('auth.no_account')}{' '}
            <Link to="/register" className="text-[var(--c-primary)] font-bold">{t('auth.register_title')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
