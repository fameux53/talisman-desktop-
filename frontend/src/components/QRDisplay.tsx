import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { RiCloseLine, RiDownloadLine, RiPrinterLine, RiShareForwardLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import TalismanLogo from './TalismanLogo';

interface QRDisplayProps {
  data: string;
  title: string;
  subtitle?: string;
  vendorName?: string;
  onClose: () => void;
}

export default function QRDisplay({ data, title, subtitle, vendorName, onClose }: QRDisplayProps) {
  const { t } = useI18n();
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    QRCode.toDataURL(data, {
      width: 280,
      margin: 2,
      color: { dark: '#1B4332', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl);
  }, [data]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `talisman-qr-${Date.now()}.png`;
    a.click();
  }, [qrDataUrl]);

  const handlePrint = useCallback(() => {
    // HTML-escape user-controlled values to prevent XSS
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const safeName = esc(vendorName ?? 'Talisman');
    const safeSubtitle = esc(subtitle ?? '');
    const safePowered = esc(t('balance.powered_by'));
    const html = `
      <!DOCTYPE html>
      <html><head><title>Talisman QR</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: system-ui; }
        .card { border: 2px solid #1B4332; border-radius: 20px; padding: 32px; text-align: center; max-width: 320px; }
        .logo { font-size: 28px; margin-bottom: 8px; }
        .name { font-size: 18px; font-weight: 800; color: #1B4332; margin-bottom: 16px; }
        .qr { width: 200px; height: 200px; margin: 0 auto 16px; }
        .subtitle { font-size: 13px; color: #6B7280; margin-bottom: 4px; }
        .powered { font-size: 11px; color: #9CA3AF; margin-top: 12px; }
      </style></head>
      <body>
        <div class="card">
          <div class="logo">T</div>
          <div class="name">${safeName}</div>
          <img src="${qrDataUrl}" class="qr" alt="QR Code" />
          <div class="subtitle">${safeSubtitle}</div>
          <div class="powered">${safePowered}</div>
        </div>
      </body></html>
    `;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  }, [qrDataUrl, vendorName, subtitle, t]);

  const handleShare = useCallback(async () => {
    if (!qrDataUrl) return;
    try {
      const blob = await (await fetch(qrDataUrl)).blob();
      const file = new File([blob], 'talisman-qr.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({ title, files: [file] });
      } else {
        await navigator.clipboard.writeText(data);
      }
    } catch {
      await navigator.clipboard.writeText(data);
    }
  }, [qrDataUrl, data, title]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--c-card)] rounded-3xl shadow-2xl max-w-[340px] w-full mx-4 animate-fade-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button type="button" onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/10 flex items-center justify-center text-[var(--c-text2)] hover:bg-black/20 z-10">
          <RiCloseLine className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="flex flex-col items-center p-6 pt-10">
          {vendorName && (
            <div className="text-center mb-4">
              <TalismanLogo variant="icon" size={28} className="mb-1" />
              <p className="font-heading text-lg font-extrabold text-[var(--c-text)]">{vendorName}</p>
            </div>
          )}

          <p className="font-heading font-bold text-[15px] text-[var(--c-text)] mb-4">{title}</p>

          {/* QR Code */}
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 rounded-2xl shadow-sm" />
          ) : (
            <div className="w-56 h-56 rounded-2xl bg-[var(--c-bg)] animate-pulse" />
          )}

          {subtitle && (
            <p className="text-[13px] text-[var(--c-text2)] mt-4 text-center">{subtitle}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-5 w-full">
            <button type="button" onClick={handleDownload}
              className="flex-1 h-11 rounded-xl bg-[var(--c-bg)] text-sm font-bold text-[var(--c-text)] flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <RiDownloadLine className="h-4 w-4" /> {t('qr.download')}
            </button>
            <button type="button" onClick={handlePrint}
              className="flex-1 h-11 rounded-xl bg-[var(--c-bg)] text-sm font-bold text-[var(--c-text)] flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              <RiPrinterLine className="h-4 w-4" /> {t('qr.print')}
            </button>
            <button type="button" onClick={handleShare}
              className="flex-1 h-11 rounded-xl gradient-primary text-sm font-bold text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm">
              <RiShareForwardLine className="h-4 w-4" /> {t('qr.share')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
