import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RiAlertLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import LanguageSelector from '../components/LanguageSelector';
import PhoneInput from '../components/PhoneInput';
import TalismanLogo from '../components/TalismanLogo';
import api from '../services/api';

const COMMON_PINS = ['000000','111111','222222','333333','444444','555555','666666','777777','888888','999999','123456','654321','012345','543210'];
function isCommonPin(p: string) { return COMMON_PINS.includes(p); }

export default function RegisterPage() {
  const { t, locale } = useI18n();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('+509');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [fieldErrorKeys, setFieldErrorKeys] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // BUG-001 fix: reset validation state when language changes so errors don't appear on untouched fields
  const [prevLocale, setPrevLocale] = useState(locale);
  if (locale !== prevLocale) {
    setPrevLocale(locale);
    setFieldErrorKeys({});
    setTouched({});
    setErrorKey('');
  }

  const localDigits = phone.startsWith('+509') ? phone.slice(4) : '';

  // Real-time validation
  const hasErrors = useMemo(() => {
    return (
      displayName.trim().length < 2 ||
      localDigits.length < 8 ||
      pin.length < 6 ||
      confirmPin.length < 6 ||
      pin !== confirmPin ||
      isCommonPin(pin)
    );
  }, [displayName, localDigits, pin, confirmPin]);

  const validateOnBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    const errs = { ...fieldErrorKeys };
    if (field === 'name' && displayName.trim().length < 2) errs.name = 'auth.error_name_short';
    else if (field === 'name') delete errs.name;
    if (field === 'phone' && localDigits.length < 8) errs.phone = 'auth.error_phone_format';
    else if (field === 'phone') delete errs.phone;
    if (field === 'pin') {
      if (pin.length < 6) errs.pin = 'auth.error_pin_short';
      else if (isCommonPin(pin)) errs.pin = 'auth.error_pin_simple';
      else delete errs.pin;
    }
    if (field === 'confirm' && pin !== confirmPin && confirmPin.length > 0) errs.confirm = 'auth.error_pin_mismatch';
    else if (field === 'confirm') delete errs.confirm;
    setFieldErrorKeys(errs);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Full validation
    const errs: Record<string, string> = {};
    if (displayName.trim().length < 2) errs.name = 'auth.error_name_short';
    if (localDigits.length < 8) errs.phone = 'auth.error_phone_format';
    if (pin.length < 6) errs.pin = 'auth.error_pin_short';
    else if (isCommonPin(pin)) errs.pin = 'auth.error_pin_simple';
    if (pin !== confirmPin) errs.confirm = 'auth.error_pin_mismatch';
    setFieldErrorKeys(errs);
    setTouched({ name: true, phone: true, pin: true, confirm: true });
    if (Object.keys(errs).length > 0) return;

    setErrorKey('');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        phone_number: phone,
        display_name: displayName,
        pin,
        preferred_language: locale.toUpperCase(),
        ...(securityQuestion && securityAnswer ? { security_question: securityQuestion, security_answer: securityAnswer } : {}),
      });
      await login(phone, pin);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number } })?.response;
      if (!resp) setErrorKey('auth.error_network');
      else if (resp.status === 409) setErrorKey('auth.error_conflict');
      else if (resp.status && resp.status >= 500) setErrorKey('auth.error_server');
      else setErrorKey('auth.error_unknown');
    } finally {
      setLoading(false);
    }
  };

  const anyTouched = Object.values(touched).some(Boolean);

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col md:bg-gradient-to-br md:from-[#1B4332] md:to-[#2D6A4F] lg:flex-row">
      <div className="absolute top-4 right-4 z-10"><LanguageSelector /></div>

      {/* Desktop branding panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
        <div className="text-white text-center">
          <TalismanLogo variant="stacked" size={180} className="mb-4" />
          <p className="text-xl text-white/80 max-w-[360px] mx-auto">{t('app.tagline')}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:items-center lg:justify-center lg:p-8">
      <div className="gradient-primary px-5 pt-12 pb-14 text-white text-center md:hidden">
        <TalismanLogo variant="stacked" size={100} className="mb-2" />
        <p className="text-white/70 text-sm mt-1.5 max-w-[280px] mx-auto">{t('app.tagline')}</p>
      </div>
      <div className="hidden md:block lg:hidden text-white text-center pt-16 pb-10">
        <TalismanLogo variant="stacked" size={100} className="mb-2" />
        <p className="text-white/70 text-sm mt-1.5 max-w-[280px] mx-auto">{t('app.tagline')}</p>
      </div>

      <div className="flex-1 px-5 -mt-6 md:mt-0 max-w-[400px] md:max-w-md w-full mx-auto pb-8 lg:flex-initial">
        <form onSubmit={handleSubmit} noValidate className="card p-6 space-y-4 md:shadow-xl md:rounded-3xl">
          <h2 className="font-heading text-xl font-bold text-center text-[var(--c-text)]">{t('auth.register_title')}</h2>

          {/* Name */}
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.display_name')}</label>
            <input id="register-name" name="displayName" autoComplete="name" type="text" value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); setFieldErrorKeys((p) => ({ ...p, name: '' })); }}
              onBlur={() => validateOnBlur('name')}
              className={`input-field ${fieldErrorKeys.name ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="Marie Jean" autoFocus
            />
            {fieldErrorKeys.name && <p className="text-red-500 text-[13px] mt-1 animate-fade-in">{t(fieldErrorKeys.name)}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="register-phone" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.phone')}</label>
            <div onBlur={() => validateOnBlur('phone')}>
              <PhoneInput id="register-phone" name="phone" value={phone}
                onChange={(v) => { setPhone(v); setFieldErrorKeys((p) => ({ ...p, phone: '' })); }}
                error={!!fieldErrorKeys.phone}
              />
            </div>
            {fieldErrorKeys.phone && <p className="text-red-500 text-[13px] mt-1 animate-fade-in">{t(fieldErrorKeys.phone)}</p>}
          </div>

          {/* PIN */}
          <div>
            <label htmlFor="register-pin" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.pin_choose')}</label>
            <input id="register-pin" name="new-password" autoComplete="new-password" type="password" inputMode="numeric"
              value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setFieldErrorKeys((p) => ({ ...p, pin: '' })); }}
              onBlur={() => validateOnBlur('pin')}
              className={`input-field text-center text-2xl tracking-[0.5em] ${fieldErrorKeys.pin ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="••••••" maxLength={6}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted">{t('auth.pin_helper')}</span>
              <span className={`text-xs font-medium ${pin.length === 6 ? 'text-emerald-600' : 'text-muted'}`}>{pin.length}/6</span>
            </div>
            {fieldErrorKeys.pin && <p className="text-red-500 text-[13px] mt-1 animate-fade-in">{t(fieldErrorKeys.pin)}</p>}
          </div>

          {/* Confirm PIN */}
          <div>
            <label htmlFor="register-pin-confirm" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.pin_confirm')}</label>
            <input id="register-pin-confirm" name="new-password" autoComplete="new-password" type="password" inputMode="numeric"
              value={confirmPin} onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setFieldErrorKeys((p) => ({ ...p, confirm: '' })); }}
              onBlur={() => validateOnBlur('confirm')}
              className={`input-field text-center text-2xl tracking-[0.5em] ${fieldErrorKeys.confirm ? 'border-red-400 ring-1 ring-red-400' : ''}`}
              placeholder="••••••" maxLength={6}
            />
            {fieldErrorKeys.confirm && <p className="text-red-500 text-[13px] mt-1 animate-fade-in">{t(fieldErrorKeys.confirm)}</p>}
          </div>

          {/* Security Question */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-bold text-[var(--c-text)] flex items-center gap-1.5">
              🔒 {t('recovery.security_question')}
            </h3>
            <p className="text-xs text-[var(--c-muted)]">{t('recovery.security_question_desc')}</p>
            <div>
              <label htmlFor="register-security-q" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('recovery.choose_question')}</label>
              <select
                id="register-security-q"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
                className="input-field"
              >
                <option value="">{t('recovery.select_question')}</option>
                <option value="q_mother">{t('recovery.q_mother')}</option>
                <option value="q_market">{t('recovery.q_market')}</option>
                <option value="q_friend">{t('recovery.q_friend')}</option>
                <option value="q_food">{t('recovery.q_food')}</option>
                <option value="q_city">{t('recovery.q_city')}</option>
              </select>
            </div>
            {securityQuestion && (
              <div>
                <label htmlFor="register-security-a" className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('recovery.your_answer')}</label>
                <input
                  id="register-security-a"
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="input-field"
                  placeholder={t('recovery.answer_placeholder')}
                />
              </div>
            )}
          </div>

          {errorKey && <p className="text-red-500 text-sm text-center animate-fade-in">{t(errorKey)}</p>}

          <button type="submit" disabled={hasErrors || loading}
            className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? t('label.loading') : t('auth.register_btn')}
          </button>

          {hasErrors && anyTouched && !loading && (
            <p className="text-xs text-[#EF4444] text-center flex items-center justify-center gap-1">
              <RiAlertLine className="h-3.5 w-3.5" /> {t('auth.fix_errors')}
            </p>
          )}

          <p className="text-center text-sm text-[var(--c-text2)]">
            {t('auth.has_account')}{' '}
            <Link to="/login" className="text-[var(--c-primary)] font-bold">{t('auth.login_title')}</Link>
          </p>
        </form>
      </div>
      </div>{/* end form panel */}
    </div>
  );
}
