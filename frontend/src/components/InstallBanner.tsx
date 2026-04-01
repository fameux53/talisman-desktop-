import { useEffect, useState } from 'react';
import { RiDownload2Line, RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';

const STORAGE_KEY = 'tlsm_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    dismiss();
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mx-4 mt-3 bg-[#DBEAFE] border border-[#3B82F6]/20 rounded-xl p-3 flex items-center gap-3 animate-fade-up">
      <RiDownload2Line className="h-6 w-6 text-[#2563EB] flex-shrink-0" />
      <p className="flex-1 text-[13px] text-[#1E40AF] leading-snug">{t('pwa.install_prompt')}</p>
      <button
        type="button"
        onClick={handleInstall}
        className="h-8 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-bold flex-shrink-0"
      >
        {t('pwa.install_btn')}
      </button>
      <button type="button" onClick={dismiss} className="p-1 flex-shrink-0" aria-label={t('aria.close')}>
        <RiCloseLine className="h-4 w-4 text-[#1E40AF]/50" />
      </button>
    </div>
  );
}
