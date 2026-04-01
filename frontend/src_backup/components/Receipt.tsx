import { RiFileCopyLine, RiShareForwardLine, RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dateFormat';
import type { ProductRecord } from '../services/db';

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

  const receiptText = [
    `━━━━━━━━━━━━━━━━━━`,
    `  🛍️ ${t('receipt.title')}`,
    `━━━━━━━━━━━━━━━━━━`,
    `${t('receipt.vendor')}: ${vendor?.display_name ?? 'MarketMama'}`,
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
    `🛍️ MarketMama`,
  ].join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(receiptText);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ text: receiptText }).catch(() => {});
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(receiptText);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
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
            className="btn flex-1 h-12 rounded-xl border-2 border-[var(--c-primary)] text-[var(--c-primary)] font-heading font-bold text-sm gap-2 hover:bg-[var(--c-primary)] hover:text-white transition-colors"
          >
            <RiFileCopyLine className="h-5 w-5" />
            {t('action.copy')}
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
