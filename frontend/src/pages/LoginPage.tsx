import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RiArrowLeftLine, RiDeleteBackLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { type EmployeeRecord } from '../services/db';
import { dataLayer } from '../services/dataLayer';
import LanguageSelector from '../components/LanguageSelector';
import PhoneInput from '../components/PhoneInput';
import TalismanLogo from '../components/TalismanLogo';
import api from '../services/api';

// Same hash as EmployeesPage — verifies employee PINs locally
async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'talisman-employee');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

type Step = 'phone' | 'select' | 'pin';

export default function LoginPage() {
  const { t } = useI18n();
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+509');
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState('');

  // Business info (populated after phone check)
  const [businessName, setBusinessName] = useState('');
  const [_vendorId, setVendorId] = useState('');

  // Person selection
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<'owner' | EmployeeRecord | null>(null);

  // PIN entry
  const [pin, setPin] = useState('');
  const pinRef = useRef('');

  const localDigits = phone.startsWith('+509') ? phone.slice(4) : '';
  const canContinue = localDigits.length === 8;

  /* ── Step 1: Check phone ────────────────────────────────────────────── */

  const handleCheckPhone = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canContinue || loading) return;
    setErrorKey('');
    setLoading(true);
    try {
      const { data } = await api.post<{ exists: boolean; vendor_id: string; display_name: string }>(
        '/auth/check-phone', { phone_number: phone },
      );
      if (!data.exists) { setErrorKey('login.phone_not_found'); return; }
      setBusinessName(data.display_name);
      setVendorId(data.vendor_id);
      const emps = await dataLayer.getEmployees( data.vendor_id);
      const active = emps.filter(emp => emp.is_active);
      setEmployees(active);
      if (active.length === 0) { setSelectedPerson('owner'); setStep('pin'); }
      else { setStep('select'); }
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number } })?.response;
      if (!resp) {
        // Offline — try cached vendor
        const cached = localStorage.getItem('tlsm_vendor');
        if (cached) {
          try {
            const v = JSON.parse(cached);
            if (v.phone_number === phone) {
              setBusinessName(v.display_name);
              setVendorId(v.id);
              const emps = await dataLayer.getEmployees( v.id);
              const active = emps.filter(emp => emp.is_active);
              setEmployees(active);
              if (active.length === 0) { setSelectedPerson('owner'); setStep('pin'); }
              else { setStep('select'); }
              return;
            }
          } catch { /* ignore */ }
        }
        setErrorKey('login.offline_no_data');
      } else if (resp.status === 429) { setErrorKey('auth.error_rate_limit'); }
      else { setErrorKey('auth.error_unknown'); }
    } finally { setLoading(false); }
  };

  /* ── Step 2: Select person ──────────────────────────────────────────── */

  const handleSelectPerson = (person: 'owner' | EmployeeRecord) => {
    setSelectedPerson(person);
    setPin('');
    pinRef.current = '';
    setErrorKey('');
    setStep('pin');
  };

  /* ── Step 3: PIN entry ──────────────────────────────────────────────── */

  const submitPin = async (pinValue: string) => {
    if (loading) return;
    setLoading(true);
    setErrorKey('');
    try {
      if (selectedPerson === 'owner') {
        // Owner login — backend validates PIN
        await login(phone, pinValue);
        navigate('/', { replace: true });
      } else if (selectedPerson) {
        // Employee login — verify PIN locally against IndexedDB hash
        const pinHash = await hashPin(pinValue);
        if (pinHash !== selectedPerson.pin_hash) {
          setErrorKey('login.wrong_pin');
          setPin(''); pinRef.current = '';
          setLoading(false);
          return;
        }
        // PIN correct — get backend session with employee scope
        await login(phone, pinValue, {
          id: selectedPerson.id,
          name: selectedPerson.name,
          role: selectedPerson.role,
          permissions: selectedPerson.permissions,
        });
        // Update last_login in IndexedDB
        await dataLayer.saveEmployee({ ...selectedPerson, last_login: new Date().toISOString() });
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number } })?.response;
      if (resp?.status === 401) setErrorKey('login.wrong_pin');
      else if (resp?.status === 423) setErrorKey('auth.error_locked');
      else if (resp?.status === 429) setErrorKey('auth.error_rate_limit');
      else if (!resp) setErrorKey('auth.error_network');
      else setErrorKey('login.error');
      setPin(''); pinRef.current = '';
    } finally { setLoading(false); }
  };

  // Stable refs for keyboard handler
  const submitPinRef = useRef(submitPin);
  submitPinRef.current = submitPin;

  const handlePinDigit = (digit: string) => {
    if (pinRef.current.length >= 6 || loading) return;
    const next = pinRef.current + digit;
    pinRef.current = next;
    setPin(next);
    setErrorKey('');
    if (next.length === 6) setTimeout(() => submitPinRef.current(next), 100);
  };

  const handlePinDelete = () => {
    if (loading) return;
    const next = pinRef.current.slice(0, -1);
    pinRef.current = next;
    setPin(next);
    setErrorKey('');
  };

  // Keyboard support for PIN step
  const pinDigitRef = useRef(handlePinDigit);
  const pinDeleteRef = useRef(handlePinDelete);
  pinDigitRef.current = handlePinDigit;
  pinDeleteRef.current = handlePinDelete;

  useEffect(() => {
    if (step !== 'pin') return;
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) pinDigitRef.current(e.key);
      else if (e.key === 'Backspace') pinDeleteRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step]);

  const goBack = () => {
    setErrorKey('');
    setPin(''); pinRef.current = '';
    if (step === 'pin' && employees.length > 0) setStep('select');
    else { setStep('phone'); setSelectedPerson(null); }
  };

  /* ── Shared UI ──────────────────────────────────────────────────────── */

  const errorBanner = errorKey ? (
    <div className="bg-red-50 text-red-600 text-sm text-center py-2.5 px-4 rounded-xl animate-fade-in font-medium">
      {t(errorKey)}
    </div>
  ) : null;

  const backBtn = (
    <button type="button" onClick={goBack}
      className="flex items-center justify-center gap-1.5 text-sm text-[var(--c-text2)] hover:text-[var(--c-text)] transition-colors mt-2 mx-auto">
      <RiArrowLeftLine className="h-4 w-4" /> {t('login.back')}
    </button>
  );

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="login-page min-h-screen flex flex-col bg-[var(--c-bg)] md:bg-gradient-to-br md:from-[#0D2818] md:via-[#1B4332] md:to-[#2D6A4F] lg:flex-row">

      {/* ── Desktop branding panel (lg+) ── */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#40916C]/20 blur-[120px]" />
        <div className="text-white relative z-10 max-w-[420px]">
          <div className="text-center mb-10 login-logo">
            <TalismanLogo variant="stacked" size={180} className="mb-4 mx-auto" />
            <p className="text-lg text-white/60">{t('app.tagline')}</p>
          </div>
          <div className="space-y-3 mb-10">
            {[
              { emoji: '📊', title: t('login.feature_track'), desc: t('login.feature_track_desc') },
              { emoji: '💳', title: t('login.feature_credit'), desc: t('login.feature_credit_desc') },
              { emoji: '📱', title: t('login.feature_offline'), desc: t('login.feature_offline_desc') },
            ].map((f, i) => (
              <div key={i} className="login-feature flex items-center gap-4 bg-white/[0.08] rounded-2xl px-5 py-3.5 backdrop-blur-sm border border-white/[0.06] hover:bg-white/[0.12]">
                <span className="text-2xl">{f.emoji}</span>
                <div>
                  <p className="font-heading font-bold text-sm">{f.title}</p>
                  <p className="text-xs text-white/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="login-testimonial bg-white/[0.06] rounded-2xl p-5 backdrop-blur-sm border border-white/[0.08]">
            <p className="text-sm text-white/70 italic leading-relaxed mb-3">&ldquo;{t('login.testimonial')}&rdquo;</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-sm font-bold">M</div>
              <div>
                <p className="text-xs font-bold text-white/90">Marie Jean-Baptiste</p>
                <p className="text-[10px] text-white/40">{t('login.testimonial_role')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 flex flex-col lg:items-center lg:justify-center lg:p-8">
        <div className="absolute top-4 right-4 z-10 lg:hidden"><LanguageSelector /></div>

        {/* Mobile header */}
        <div className="login-mobile-header gradient-primary px-5 pt-10 pb-12 text-white text-center md:hidden">
          <TalismanLogo variant="icon" size={48} className="mx-auto mb-3" />
          <h1 className="font-heading text-2xl font-extrabold">Talisman</h1>
        </div>

        {/* Tablet header */}
        <div className="login-mobile-header hidden md:block lg:hidden text-white text-center pt-14 pb-8">
          <TalismanLogo variant="icon" size={48} className="mx-auto mb-3" />
          <h1 className="font-heading text-2xl font-extrabold">Talisman</h1>
        </div>

        {/* Step content */}
        <div className="flex-1 flex flex-col justify-center px-5 -mt-6 md:mt-0 max-w-[420px] w-full mx-auto lg:flex-initial">

          {/* ── STEP 1: Phone ── */}
          {step === 'phone' && (
            <form onSubmit={handleCheckPhone}
              className="login-form bg-white rounded-3xl p-7 space-y-5 shadow-xl border border-gray-100 md:shadow-2xl animate-fade-up"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>
              <div className="flex justify-between items-center">
                <h2 className="font-heading text-xl font-bold text-[var(--c-text)]">{t('auth.login_title')}</h2>
                <div className="hidden lg:block"><LanguageSelector /></div>
              </div>

              <div>
                <label htmlFor="login-phone" className="block text-[13px] font-semibold text-[var(--c-text2)] mb-1.5">
                  {t('auth.phone')}
                </label>
                <PhoneInput id="login-phone" name="phone" value={phone}
                  onChange={(v) => { setPhone(v); setErrorKey(''); }} error={!!errorKey} autoFocus />
              </div>

              {errorBanner}

              <button type="submit" disabled={loading || !canContinue}
                className="login-submit w-full h-[52px] rounded-xl text-white text-lg font-heading font-extrabold shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #2D6A4F 0%, #40916C 100%)' }}>
                {loading && <LoadingSpinner />}
                {loading ? t('login.checking') : t('login.continue')}
              </button>

              <div className="space-y-2 pt-1">
                <p className="text-center text-sm text-[var(--c-text2)]">
                  {t('auth.no_account')}{' '}
                  <Link to="/register" className="text-[var(--c-primary)] font-bold hover:underline">{t('auth.register_title')}</Link>
                </p>
                <p className="text-center">
                  <Link to="/forgot-pin" className="text-[12px] text-[var(--c-muted)] hover:text-[var(--c-primary)] transition-colors">
                    {t('auth.forgot_pin')}
                  </Link>
                </p>
              </div>
            </form>
          )}

          {/* ── STEP 2: Person selection ── */}
          {step === 'select' && (
            <div className="bg-white rounded-3xl p-6 space-y-4 shadow-xl border border-gray-100 md:shadow-2xl animate-fade-up"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>
              <div className="text-center">
                <p className="text-sm text-[var(--c-text2)]">{businessName}</p>
                <h2 className="font-heading text-xl font-bold text-[var(--c-text)]">{t('employees.who_are_you')}</h2>
              </div>

              {/* Owner */}
              <button type="button" onClick={() => handleSelectPerson('owner')}
                className="w-full p-4 rounded-2xl border-2 border-[var(--c-primary)] bg-[var(--c-primary)]/5 hover:bg-[var(--c-primary)]/10 transition-colors flex items-center gap-4 text-left">
                <span className="text-3xl">👑</span>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-bold text-[var(--c-text)] truncate">{businessName}</p>
                  <p className="text-sm text-[var(--c-text2)]">{t('employees.role_owner')}</p>
                </div>
              </button>

              {/* Employees */}
              {employees.map((emp) => (
                <button key={emp.id} type="button" onClick={() => handleSelectPerson(emp)}
                  className="w-full p-4 rounded-2xl border border-gray-200 hover:border-[var(--c-primary)] hover:bg-gray-50 transition-colors flex items-center gap-4 text-left">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-heading font-bold text-white text-lg flex-shrink-0 ${
                    emp.role === 'manager' ? 'bg-[#3B82F6]' : 'bg-[#F4A261]'
                  }`}>
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-[var(--c-text)] truncate">{emp.name}</p>
                    <p className="text-sm text-[var(--c-text2)]">{t(`employees.role_${emp.role}`)}</p>
                  </div>
                </button>
              ))}

              {backBtn}
            </div>
          )}

          {/* ── STEP 3: PIN entry ── */}
          {step === 'pin' && (
            <div className="bg-white rounded-3xl p-6 space-y-5 shadow-xl border border-gray-100 md:shadow-2xl animate-fade-up"
              style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}>

              {/* Selected person info */}
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl ${
                  selectedPerson === 'owner'
                    ? 'gradient-primary'
                    : (selectedPerson as EmployeeRecord).role === 'manager' ? 'bg-[#3B82F6] text-white' : 'bg-[#F4A261] text-white'
                }`}>
                  {selectedPerson === 'owner'
                    ? '👑'
                    : <span className="font-heading font-bold">{(selectedPerson as EmployeeRecord).name.charAt(0).toUpperCase()}</span>}
                </div>
                <p className="font-heading font-bold text-lg text-[var(--c-text)]">
                  {selectedPerson === 'owner' ? businessName : (selectedPerson as EmployeeRecord).name}
                </p>
                <p className="text-sm text-[var(--c-text2)]">
                  {selectedPerson === 'owner'
                    ? t('employees.role_owner')
                    : t(`employees.role_${(selectedPerson as EmployeeRecord).role}`)}
                </p>
              </div>

              <p className="text-center text-sm text-[var(--c-text2)]">{t('employees.enter_pin')}</p>

              {/* PIN dots */}
              <div className="flex justify-center gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    i < pin.length ? 'bg-[#2D6A4F] scale-125' : 'bg-gray-200'
                  }`} />
                ))}
              </div>

              {errorBanner}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                {['1','2','3','4','5','6','7','8','9','','0','del'].map((d, i) => {
                  if (d === '') return <div key={i} />;
                  if (d === 'del') return (
                    <button key={i} type="button" onClick={handlePinDelete} disabled={loading}
                      className="h-14 rounded-2xl flex items-center justify-center text-[var(--c-text2)] hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-40">
                      <RiDeleteBackLine className="h-6 w-6" />
                    </button>
                  );
                  return (
                    <button key={i} type="button" onClick={() => handlePinDigit(d)} disabled={loading}
                      className="h-14 rounded-2xl bg-[var(--c-bg)] text-xl font-heading font-bold text-[var(--c-text)] hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all">
                      {d}
                    </button>
                  );
                })}
              </div>

              {loading && (
                <div className="flex justify-center">
                  <LoadingSpinner className="text-[#2D6A4F]" />
                </div>
              )}

              {backBtn}

              {selectedPerson === 'owner' && (
                <p className="text-center">
                  <Link to="/forgot-pin" className="text-[12px] text-[var(--c-muted)] hover:text-[var(--c-primary)] transition-colors">
                    {t('auth.forgot_pin')}
                  </Link>
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-[10px] text-white/30 md:text-white/40 mt-6">
            &copy; {new Date().getFullYear()} Talisman &middot; Biznis Asistan pou Machann
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner({ className = 'text-white/80' }: { className?: string }) {
  return (
    <svg className={`animate-spin h-5 w-5 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
