import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';

function getOnboardingKey(vendorId?: string): string {
  return vendorId ? `tlsm_onboarding_complete_${vendorId}` : 'tlsm_onboarding_complete';
}

interface TourStep {
  target: string; // data-tour attribute value
  textKey: string; // i18n key
  position: 'above' | 'below';
}

const STEPS: TourStep[] = [
  { target: 'hero-card', textKey: 'onboarding.tour_step1', position: 'below' },
  { target: 'fab-button', textKey: 'onboarding.tour_step2', position: 'above' },
  { target: 'bottom-nav', textKey: 'onboarding.tour_step3', position: 'above' },
  { target: 'lang-selector', textKey: 'onboarding.tour_step4', position: 'below' },
];

export default function OnboardingTour() {
  const { t } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id);
  const storageKey = getOnboardingKey(vendorId);
  const [step, setStep] = useState(-1); // -1 = not started
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isActive = step >= 0 && step < STEPS.length;

  // Start tour after delay on first login
  useEffect(() => {
    if (!vendorId || localStorage.getItem(storageKey)) return;
    const timer = setTimeout(() => setStep(0), 1200);
    return () => clearTimeout(timer);
  }, [vendorId, storageKey]);

  // Listen for restart event (from settings)
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem(storageKey);
      setStep(0);
    };
    document.addEventListener('restart-tour', handler);
    return () => document.removeEventListener('restart-tour', handler);
  }, [storageKey]);

  // Find and measure target element — skip steps whose target doesn't exist (e.g. FAB hidden on desktop)
  const measureTarget = useCallback(() => {
    if (step < 0 || step >= STEPS.length) return;
    const el = document.querySelector(`[data-tour="${STEPS[step].target}"]`);
    // Check element exists AND is visible (non-zero size, on-screen)
    const r = el?.getBoundingClientRect();
    const isVisible = r && r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0;
    if (el && isVisible) {
      setRect(r);
    } else {
      // Target not in DOM or hidden on this viewport — auto-skip to next step
      if (step >= STEPS.length - 1) {
        setStep(-1);
        setRect(null);
        localStorage.setItem(storageKey, '1');
      } else {
        setStep((s) => s + 1);
      }
    }
  }, [step, storageKey]);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [measureTarget]);

  const finish = useCallback(() => {
    setStep(-1);
    setRect(null);
    localStorage.setItem(storageKey, '1');
  }, [storageKey]);

  const next = useCallback(() => {
    if (step >= STEPS.length - 1) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, finish]);

  if (!isActive || !rect) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const pad = 8;

  // Calculate tooltip position
  const tooltipStyle: React.CSSProperties = {
    left: Math.max(16, Math.min(rect.left, window.innerWidth - 316)),
    maxWidth: 300,
  };
  if (currentStep.position === 'below') {
    tooltipStyle.top = rect.bottom + pad + 12;
  } else {
    tooltipStyle.bottom = window.innerHeight - rect.top + pad + 12;
  }

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in">
      {/* Spotlight cutout via box-shadow */}
      <div
        className="absolute rounded-2xl z-[101]"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          pointerEvents: 'none',
        }}
      >
        <div className="absolute inset-0 rounded-2xl ring-4 ring-white/40 animate-pulse" />
      </div>

      {/* Click overlay to advance */}
      <div className="absolute inset-0 z-[100]" onClick={next} />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="absolute z-[102] bg-white rounded-2xl shadow-2xl p-5 animate-fade-up"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold text-[var(--c-text2)] mb-1 uppercase tracking-wider">
          {t('onboarding.tour_step_label').replace('{current}', String(step + 1)).replace('{total}', String(STEPS.length))}
        </p>
        <p className="text-[14px] text-[var(--c-text)] leading-relaxed mb-4">
          {t(currentStep.textKey)}
        </p>
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={finish}
            className="text-[13px] text-[var(--c-text2)] hover:text-[var(--c-text)] transition-colors"
          >
            {t('onboarding.tour_skip')}
          </button>
          <button
            type="button"
            onClick={next}
            className="gradient-primary text-white px-5 py-2 rounded-xl text-[14px] font-bold active:scale-95 transition-transform"
          >
            {isLast ? t('onboarding.tour_finish') : t('onboarding.tour_next')}
          </button>
        </div>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-[var(--c-primary)]' : i < step ? 'bg-[var(--c-primary)]/40' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
