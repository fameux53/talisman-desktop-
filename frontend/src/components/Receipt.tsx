import { useState } from 'react';
import { RiFileCopyLine, RiShareForwardLine, RiCloseLine, RiPrinterLine, RiCheckLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dateFormat';

interface ReceiptProps {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  onClose: () => void;
}

export default function Receipt({ productName, quantity, unitPrice, total, onClose }: ReceiptProps) {
  const { t, locale } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);

  const receiptNumber = `TLSM-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const receiptText = [
    `━━━━━━━━━━━━━━━━━━`,
    `  TALISMAN ${t('receipt.title')}`,
    `━━━━━━━━━━━━━━━━━━`,
    `# ${receiptNumber}`,
    `${t('receipt.vendor')}: ${vendor?.display_name ?? 'Talisman'}`,
    `${t('receipt.date')}: ${formatDate(new Date(), locale)}`,
    `──────────────────`,
    `${t('receipt.item')}: ${productName}`,
    `${t('receipt.qty')}: ${quantity}`,
    `${t('receipt.price')}: ${formatCurrency(unitPrice, locale)}`,
    `──────────────────`,
    `${t('receipt.total')}: ${formatCurrency(total, locale)}`,
    `━━━━━━━━━━━━━━━━━━`,
    `${t('receipt.thank_you')}`,
    ``,
    `TALISMAN`,
  ].join('\n');

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ text: receiptText }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    // HTML-escape to prevent XSS from user-controlled product/vendor names
    const safe = receiptText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    win.document.write(`<pre style="font-family:monospace;font-size:14px;padding:20px;white-space:pre-wrap">${safe}</pre>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop — no click-to-dismiss so user can copy/print without accidental close */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-bold">{t('receipt.title')}</h3>
          <button type="button" onClick={onClose} className="p-1.5" aria-label={t('aria.close')}>
            <RiCloseLine className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        {/* Receipt preview */}
        <pre className="bg-[var(--c-bg)] rounded-xl p-4 text-sm font-mono text-[var(--c-text)] whitespace-pre-wrap leading-relaxed mb-4 overflow-x-auto">
          {receiptText}
        </pre>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className={`btn flex-1 h-12 rounded-xl border-2 font-heading font-bold text-sm gap-2 transition-colors ${
              copied
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-[var(--c-primary)] text-[var(--c-primary)] hover:bg-[var(--c-primary)] hover:text-white'
            }`}
          >
            {copied ? <RiCheckLine className="h-5 w-5" /> : <RiFileCopyLine className="h-5 w-5" />}
            {copied ? t('receipt.copied') : t('action.copy')}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn h-12 w-12 rounded-xl border-2 border-gray-200 text-[var(--c-text2)] flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
            title={t('action.print')}
          >
            <RiPrinterLine className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="btn flex-1 h-12 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-2 shadow-md"
          >
            <RiShareForwardLine className="h-5 w-5" />
            {t('receipt.share')}
          </button>
        </div>
      </div>
    </div>
  );
}
