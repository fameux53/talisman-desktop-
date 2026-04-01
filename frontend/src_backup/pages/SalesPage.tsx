import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RiMicFill, RiStopFill, RiAddLine, RiSubtractLine, RiMic2Line, RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useProducts } from '../hooks/useProducts';
import { useTodaySales } from '../hooks/useTodaySales';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import Toast, { type ToastVariant } from '../components/Toast';
import Receipt from '../components/Receipt';
import api from '../services/api';
import { putInStore, type TransactionRecord, type ProductRecord, type ReceiptRecord } from '../services/db';

interface NlpResult {
  intent: string;
  product_name: string | null;
  quantity: number | null;
  unit_price: number | null;
}

export default function SalesPage() {
  const { t } = useI18n();
  const { products } = useProducts();
  const { sales, refresh: refreshSales } = useTodaySales();
  const enqueue = useSyncStore((s) => s.enqueue);
  const vendor = useAuthStore((s) => s.vendor);

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const formRef = useRef<HTMLElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [errors, setErrors] = useState<{ product?: string; quantity?: string; price?: string }>({});
  const [voiceTipDismissed, setVoiceTipDismissed] = useState(() => localStorage.getItem('mm_voice_tip_dismissed') === '1');
  const [receiptData, setReceiptData] = useState<{ product: string; qty: number; price: number; total: number } | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  useEffect(() => {
    if (selectedProduct) setUnitPrice(selectedProduct.current_price);
  }, [selectedProduct]);

  // Clear validation errors when fields change
  useEffect(() => { if (productId) setErrors((e) => ({ ...e, product: undefined })); }, [productId]);
  useEffect(() => { if (quantity > 0) setErrors((e) => ({ ...e, quantity: undefined })); }, [quantity]);
  useEffect(() => { if (unitPrice > 0) setErrors((e) => ({ ...e, price: undefined })); }, [unitPrice]);

  const total = useMemo(() => quantity * unitPrice, [quantity, unitPrice]);

  const handleVoiceResult = useCallback(
    async (text: string) => {
      try {
        const { data } = await api.post<NlpResult>('/nlp/parse', { text });
        if (data.intent === 'RECORD_SALE') {
          if (data.quantity) setQuantity(data.quantity);
          if (data.unit_price) setUnitPrice(data.unit_price);
          if (data.product_name) {
            const match = products.find(
              (p) =>
                p.name.toLowerCase().includes(data.product_name!.toLowerCase()) ||
                p.name_creole?.toLowerCase().includes(data.product_name!.toLowerCase()),
            );
            if (match) setProductId(match.id);
          }
        }
      } catch (err) { console.warn('[MarketMama] NLP parse failed:', err); }
    },
    [products],
  );

  const speech = useSpeechInput(handleVoiceResult);

  const handleSubmit = async () => {
    // Validate
    const newErrors: typeof errors = {};
    if (!productId) newErrors.product = t('validation.select_product');
    if (quantity <= 0) newErrors.quantity = t('validation.quantity_min');
    if (unitPrice <= 0) newErrors.price = t('validation.price_min');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      submitRef.current?.classList.remove('animate-shake');
      void submitRef.current?.offsetWidth;
      submitRef.current?.classList.add('animate-shake');
      return;
    }
    setErrors({});
    setSaving(true);
    const apiPayload = {
      product_id: productId || null,
      transaction_type: 'SALE' as const,
      quantity: quantity.toFixed(2),
      unit_price: unitPrice.toFixed(2),
      total_amount: total.toFixed(2),
      recorded_offline: true,
    };
    try {
      // Offline-first: always write to IndexedDB first
      const localTxn: TransactionRecord = {
        id: crypto.randomUUID(),
        vendor_id: vendor?.id ?? '',
        product_id: productId || undefined,
        transaction_type: 'SALE',
        quantity,
        unit_price: unitPrice,
        total_amount: total,
        recorded_offline: true,
      };
      await putInStore('transactions', localTxn);

      // Decrement stock locally
      let stockWarning = '';
      if (selectedProduct) {
        const newStock = Math.max(0, selectedProduct.stock_quantity - quantity);
        await putInStore('products', { ...selectedProduct, stock_quantity: newStock });
        if (newStock <= selectedProduct.low_stock_threshold) {
          stockWarning = t('stock.warning')
            .replace('{product}', selectedProduct.name)
            .replace('{remaining}', String(newStock))
            .replace('{unit}', selectedProduct.unit);
        }
      }

      // Queue for sync
      await enqueue({ endpoint: '/transactions', method: 'POST', body: apiPayload });
      if (navigator.onLine) {
        api.post('/transactions', { ...apiPayload, recorded_offline: false }).catch(() => {});
      }

      // Success animation
      formRef.current?.classList.remove('animate-success-pop');
      void formRef.current?.offsetWidth;
      formRef.current?.classList.add('animate-success-pop');

      // Save receipt to IndexedDB + state
      const prodName = selectedProduct?.name ?? '—';
      const receipt: ReceiptRecord = { id: crypto.randomUUID(), productName: prodName, quantity, unitPrice, total, createdAt: new Date().toISOString() };
      await putInStore('receipts', receipt);
      setReceiptData({ product: prodName, qty: quantity, price: unitPrice, total });

      showToast(
        navigator.onLine ? t('message.sale_recorded') : t('status.saved_offline'),
        navigator.onLine ? 'success' : 'offline',
      );

      // Show stock warning after a brief delay so the success toast is seen first
      if (stockWarning) {
        setTimeout(() => showToast(stockWarning, 'warning'), 2000);
      }
      setQuantity(1);
      setProductId('');
      setUnitPrice(0);
      refreshSales();
    } catch (err) { console.error('[MarketMama] Sale save failed:', err); } finally { setSaving(false); }
  };

  function showToast(msg: string, variant: ToastVariant = 'success') {
    setToast(msg);
    setToastVariant(variant);
    setTimeout(() => setToast(''), 2500);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 space-y-5 animate-fade-up">
      <Toast msg={toast} variant={toastVariant} />

      {/* ── Voice button hero ── */}
      <section className="flex flex-col items-center pt-2 pb-4">
        {speech.supported ? (
          <div className="relative">
            {/* Pulse rings */}
            {speech.listening && (
              <>
                <span className="absolute inset-0 rounded-full bg-[var(--c-primary)] opacity-30 animate-pulse-ring" />
                <span className="absolute inset-0 rounded-full bg-[var(--c-primary)] opacity-20 animate-pulse-ring" style={{ animationDelay: '0.4s' }} />
              </>
            )}
            <button
              type="button"
              onClick={speech.listening ? speech.stop : speech.start}
              className={`relative z-10 flex items-center justify-center h-20 w-20 rounded-full shadow-lg transition-all ${
                speech.listening
                  ? 'bg-[#E76F51] scale-110'
                  : 'gradient-primary active:scale-95'
              }`}
              aria-label={speech.listening ? t('action.stop') : t('aria.voice_record')}
            >
              {speech.listening ? (
                <RiStopFill className="h-9 w-9 text-white" />
              ) : (
                <RiMicFill className="h-9 w-9 text-white" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--c-text2)]">{t('message.speech_not_supported')}</p>
        )}
        <p className="mt-3 text-sm text-[var(--c-text2)] text-center">
          {speech.listening ? t('label.listening') : speech.transcript || t('label.voice_input')}
        </p>
      </section>

      {/* ── Sale form ── */}
      <section ref={formRef} className="card p-5 space-y-3">
        {/* Product dropdown */}
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.product')}</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={`input-field ${errors.product ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`}
          >
            <option value="">{t('label.select_product')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.name_creole ? ` (${p.name_creole})` : ''}
              </option>
            ))}
          </select>
          {errors.product && <p className="text-[#E76F51] text-[13px] mt-1 animate-fade-in">{errors.product}</p>}
        </div>

        {/* Quantity stepper */}
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">
            {t('label.quantity')}
            {selectedProduct && <span className="text-gray-400 ml-1">({selectedProduct.unit})</span>}
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label={t('aria.decrease_qty')}
              className={`flex items-center justify-center h-12 w-12 rounded-full border-2 border-[var(--c-primary)]/20 active:scale-95 transition-all ${
                quantity <= 1 ? 'bg-gray-100 text-gray-300 opacity-50' : 'bg-[var(--c-bg)] text-[var(--c-primary)]'
              }`}
            >
              <RiSubtractLine className="h-5 w-5" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                const raw = e.target.value.replace(/^0+(?=\d)/, '');
                const n = parseInt(raw, 10);
                setQuantity(isNaN(n) ? 0 : Math.max(0, n));
              }}
              onBlur={() => setQuantity((q) => Math.max(1, Math.round(q)))}
              className={`flex-1 h-12 rounded-xl border text-center text-2xl font-heading font-bold text-[var(--c-text)] focus:ring-2 focus:ring-[var(--c-primary)] focus:border-transparent ${
                errors.quantity ? 'border-[#E76F51]' : 'border-gray-200'
              }`}
              min={1}
              step={1}
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label={t('aria.increase_qty')}
              className="flex items-center justify-center h-12 w-12 rounded-full bg-[var(--c-primary)] text-white active:scale-95 transition-transform"
            >
              <RiAddLine className="h-5 w-5" />
            </button>
          </div>
          {errors.quantity && <p className="text-[#E76F51] text-[13px] mt-1 animate-fade-in">{errors.quantity}</p>}
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.price')} ({t('label.currency')})</label>
          <input
            type="number"
            inputMode="decimal"
            value={unitPrice || ''}
            onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value)))}
            className={`input-field ${errors.price ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`}
            min={0}
          />
          {errors.price && <p className="text-[#E76F51] text-[13px] mt-1 animate-fade-in">{errors.price}</p>}
        </div>

        {/* Total + Submit */}
        <div className="border-t border-dashed border-gray-200 -mx-5 px-5 pt-4 mt-2 bg-[var(--c-bg)]/60 -mb-5 pb-5 rounded-b-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--c-text2)]">{t('label.total')}</span>
            <p className="font-heading text-3xl font-extrabold text-[var(--c-primary)]">
              {total.toLocaleString()} <span className="text-base font-bold">{t('label.currency')}</span>
            </p>
          </div>
          <button
            ref={submitRef}
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40"
          >
            {saving ? t('label.loading') : `${t('action.record_sale')} ✅`}
          </button>
        </div>
      </section>

      {/* ── Today's sales ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading text-lg font-bold">
            {t('label.today_sales')}
            {sales.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-[var(--c-primary)] text-white text-xs font-bold px-1.5">
                {sales.length}
              </span>
            )}
          </h3>
        </div>

        {sales.length === 0 ? (
          <div className="space-y-3">
            <div className="card p-10 text-center space-y-4">
              <p className="text-5xl">🛒</p>
              <p className="text-[var(--c-text2)] text-base">{t('label.no_sales_today')}</p>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md gap-2"
              >
                <RiAddLine className="h-5 w-5" />
                {t('sales.first_cta')}
              </button>
            </div>
            {/* Voice tip */}
            {!voiceTipDismissed && (
              <div className="bg-[#F0F9FF] rounded-xl p-4 flex gap-3 items-start relative animate-fade-up">
                <RiMic2Line className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1E40AF] mb-0.5">{t('tip.voice_title')}</p>
                  <p className="text-[13px] text-[#1E40AF] leading-snug">{t('tip.voice_body')}</p>
                </div>
                <button type="button" onClick={() => { localStorage.setItem('mm_voice_tip_dismissed', '1'); setVoiceTipDismissed(true); }}
                  className="p-1 flex-shrink-0 -mt-1 -mr-1" aria-label={t('aria.close')}>
                  <RiCloseLine className="h-4 w-4 text-[#1E40AF]/50" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sales.map((s, i) => {
              const product = products.find((p) => p.id === s.product_id);
              return (
                <div key={s.id} className="card px-4 py-3 flex items-center justify-between animate-card-appear" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--c-text)] text-base truncate">{product?.name ?? '—'}</p>
                    <p className="text-xs text-[var(--c-text2)]">
                      {s.quantity} x {s.unit_price} {t('label.currency')}
                      {s.recorded_offline && <span className="ml-1 text-[#F4A261]">({t('label.offline_tag')})</span>}
                    </p>
                  </div>
                  <span className="font-heading font-bold text-lg text-[var(--c-primary)] ml-2">
                    {Number(s.total_amount).toLocaleString()} {t('label.currency')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Receipt sheet ── */}
      {receiptData && (
        <Receipt
          productName={receiptData.product}
          quantity={receiptData.qty}
          unitPrice={receiptData.price}
          total={receiptData.total}
          onClose={() => setReceiptData(null)}
        />
      )}
    </div>
  );
}
