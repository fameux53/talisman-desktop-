import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { RiLockLine, RiArrowLeftLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import api from '../services/api';
import PhoneInput from '../components/PhoneInput';

type Step = 'phone' | 'code' | 'new_pin' | 'done' | 'security_question';

export default function ForgotPinPage() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [sqNewPin, setSqNewPin] = useState('');
  const [sqConfirmPin, setSqConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // ── Step 1: Request SMS code ──
  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 8) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-pin/request', { phone_number: phone });
      setStep('code');
      setCooldown(60);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } catch {
      // Always proceed — backend doesn't reveal if phone exists
      setStep('code');
      setCooldown(60);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify code ──
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      codeRefs.current[5]?.focus();
      e.preventDefault();
    }
  };

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/forgot-pin/verify', {
        phone_number: phone,
        code: fullCode,
      });
      setResetToken(data.reset_token);
      setStep('new_pin');
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail ?? '';
      if (status === 429 || detail.includes('Too many')) {
        setError(t('auth.too_many_attempts'));
      } else if (detail.includes('expired')) {
        setError(t('auth.code_expired'));
      } else {
        setError(t('auth.invalid_code'));
      }
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      await api.post('/auth/forgot-pin/request', { phone_number: phone });
      setCooldown(60);
      setCode(['', '', '', '', '', '']);
    } catch { /* silent */ }
  };

  // ── Step 3: Set new PIN ──
  const handleResetPin = async (e: FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 6 || newPin !== confirmPin) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-pin/reset', {
        reset_token: resetToken,
        new_pin: newPin,
      });
      setStep('done');
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? '';
      if (detail.includes('simple')) {
        setError(t('auth.error_pin_simple'));
      } else {
        setError(detail || t('assistant.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Mask phone for display: +509 37**-**78
  const maskedPhone = phone.length >= 4
    ? `+509 ${phone.slice(0, 2)}**-**${phone.slice(-2)}`
    : phone;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--c-bg)' }}>
      <div className="w-full max-w-[400px]">
        {/* Back link */}
        <Link to="/login" className="flex items-center gap-1 text-[var(--c-primary)] font-medium text-sm mb-4">
          <RiArrowLeftLine className="h-4 w-4" /> {t('auth.back_to_login')}
        </Link>

        <div className="card p-6 space-y-5">
          {/* Header */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl mx-auto mb-3">
              <RiLockLine className="h-7 w-7" />
            </div>
            <h1 className="font-heading text-xl font-bold text-[var(--c-text)]">
              {step === 'done' ? '✅' : '🔓'} {step === 'code' ? t('auth.enter_code') : step === 'new_pin' ? t('auth.new_pin') : step === 'done' ? t('auth.pin_changed').split('!')[0] + '!' : step === 'security_question' ? t('recovery.security_question') : t('auth.recover_title')}
            </h1>
          </div>

          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.enter_phone')}</label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>
              <p className="text-[12px] text-[var(--c-muted)]">{t('auth.send_code_desc')}</p>
              <button type="submit" disabled={loading || phone.length < 8}
                className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base disabled:opacity-40">
                {loading ? '...' : t('auth.send_code')}
              </button>
              <button type="button" onClick={() => { setError(''); setStep('security_question'); }}
                className="w-full text-center text-sm text-[var(--c-primary)] font-medium mt-2">
                {t('recovery.use_security_question')}
              </button>
            </form>
          )}

          {/* ── Step 2: Code ── */}
          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-[var(--c-text2)] text-center">
                {t('auth.code_sent_to')} <strong>{maskedPhone}</strong>
              </p>

              {/* 6-digit code input */}
              <div className="flex justify-center gap-2" onPaste={handleCodePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { codeRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleCodeInput(i, e.target.value)}
                    onKeyDown={e => handleCodeKeyDown(i, e)}
                    className="w-11 h-14 text-center text-2xl font-heading font-bold rounded-xl border-2 border-gray-200 bg-gray-50 text-[var(--c-text)] outline-none focus:border-[var(--c-primary)] transition-colors"
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {/* Resend */}
              <div className="text-center">
                <p className="text-[12px] text-[var(--c-muted)]">{t('auth.code_not_received')}</p>
                <button type="button" onClick={handleResend} disabled={cooldown > 0}
                  className="text-[12px] font-bold text-[var(--c-primary)] disabled:text-[var(--c-muted)]">
                  {cooldown > 0 ? `${t('auth.resend_code')} (${cooldown}s)` : t('auth.resend_code')}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm text-center animate-fade-in">{error}</p>}

              <button type="submit" disabled={loading || code.join('').length !== 6}
                className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base disabled:opacity-40">
                {loading ? '...' : t('auth.verify')}
              </button>
            </form>
          )}

          {/* ── Step 3: New PIN ── */}
          {step === 'new_pin' && (
            <form onSubmit={handleResetPin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.new_pin_label')}</label>
                <input type="password" inputMode="numeric" maxLength={6} value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-2xl tracking-[0.3em] font-heading font-bold"
                  placeholder="••••••" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.confirm_pin')}</label>
                <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-2xl tracking-[0.3em] font-heading font-bold"
                  placeholder="••••••" />
              </div>
              {newPin && confirmPin && newPin !== confirmPin && (
                <p className="text-red-500 text-xs">{t('auth.error_pin_mismatch')}</p>
              )}
              {error && <p className="text-red-500 text-sm text-center animate-fade-in">{error}</p>}
              <button type="submit" disabled={loading || newPin.length !== 6 || newPin !== confirmPin}
                className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base disabled:opacity-40">
                {loading ? '...' : t('auth.change_pin')}
              </button>
            </form>
          )}

          {/* ── Security Question Step ── */}
          {step === 'security_question' && (
            <form onSubmit={async (e: FormEvent) => {
              e.preventDefault();
              if (!phone || phone.length < 8 || !securityAnswer.trim()) return;
              if (sqNewPin.length !== 6 || sqNewPin !== sqConfirmPin) return;
              setLoading(true);
              setError('');
              try {
                await api.post('/auth/forgot-pin/security-question', {
                  phone_number: phone,
                  security_answer: securityAnswer,
                  new_pin: sqNewPin,
                });
                setStep('done');
              } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? '';
                if (status === 404 || detail.includes('No security question')) {
                  setError(t('recovery.no_question_set'));
                } else if (status === 400 || detail.includes('Incorrect')) {
                  setError(t('recovery.incorrect_answer'));
                } else if (detail.includes('simple')) {
                  setError(t('auth.error_pin_simple'));
                } else {
                  setError(detail || t('assistant.error'));
                }
              } finally {
                setLoading(false);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.enter_phone')}</label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('recovery.your_answer')}</label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  className="input-field"
                  placeholder={t('recovery.answer_placeholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.new_pin_label')}</label>
                <input type="password" inputMode="numeric" maxLength={6} value={sqNewPin}
                  onChange={e => setSqNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-2xl tracking-[0.3em] font-heading font-bold"
                  placeholder="••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.confirm_pin')}</label>
                <input type="password" inputMode="numeric" maxLength={6} value={sqConfirmPin}
                  onChange={e => setSqConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input-field text-center text-2xl tracking-[0.3em] font-heading font-bold"
                  placeholder="••••••" />
              </div>
              {sqNewPin && sqConfirmPin && sqNewPin !== sqConfirmPin && (
                <p className="text-red-500 text-xs">{t('auth.error_pin_mismatch')}</p>
              )}
              {error && <p className="text-red-500 text-sm text-center animate-fade-in">{error}</p>}
              <button type="submit" disabled={loading || !phone || phone.length < 8 || !securityAnswer.trim() || sqNewPin.length !== 6 || sqNewPin !== sqConfirmPin}
                className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base disabled:opacity-40">
                {loading ? '...' : t('auth.change_pin')}
              </button>
              <button type="button" onClick={() => { setError(''); setStep('phone'); }}
                className="w-full text-center text-sm text-[var(--c-primary)] font-medium">
                {t('recovery.use_sms')}
              </button>
            </form>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <p className="text-[var(--c-text2)]">{t('auth.pin_changed')}</p>
              <Link to="/login"
                className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base">
                {t('auth.back_to_login')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
