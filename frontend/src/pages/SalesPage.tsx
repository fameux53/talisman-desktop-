import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RiMicFill, RiStopFill, RiAddLine, RiSubtractLine, RiMic2Line, RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useProducts } from '../hooks/useProducts';
import { useProductMap } from '../hooks/useProductMap';
import { useTodaySales } from '../hooks/useTodaySales';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';
import Toast, { type ToastVariant } from '../components/Toast';
import Receipt from '../components/Receipt';
import api from '../services/api';
import { putInStore, getVendorRecords, type TransactionRecord, type ReceiptRecord, type MonCashPayment, type LoyaltyProgramRecord, type LoyaltyCardRecord } from '../services/db';
import { putCreditEntrySecure } from '../services/secureDb';
import { upsertCustomer } from '../services/db';
import { getAllCustomersSecure } from '../services/secureDb';

interface NlpResult {
  intent: string;
  product_name: string | null;
  quantity: number | null;
  unit_price: number | null;
}

export default function SalesPage({ isSheet, onComplete }: { isSheet?: boolean; onComplete?: (receipt?: { product: string; qty: number; price: number; total: number }) => void } = {}) {
  const { t } = useI18n();
  const { products } = useProducts();
  const { resolveProduct } = useProductMap();
  const { sales, refresh: refreshSales } = useTodaySales();
  const enqueue = useSyncStore((s) => s.enqueue);
  const vendor = useAuthStore((s) => s.vendor);
  const currentEmployee = useAuthStore((s) => s.currentEmployee);

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const formRef = useRef<HTMLElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const [errors, setErrors] = useState<{ product?: string; quantity?: string; price?: string }>({});
  const [voiceTipDismissed, setVoiceTipDismissed] = useState(() => localStorage.getItem('tlsm_voice_tip_dismissed') === '1');
  const [receiptData, setReceiptData] = useState<{ product: string; qty: number; price: number; total: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'moncash' | 'credit'>('cash');
  const [moncashPhone, setMoncashPhone] = useState('+509');
  const [moncashStep, setMoncashStep] = useState<'idle' | 'phone' | 'waiting'>('idle');
  const [moncashRef, setMoncashRef] = useState('');
  // Credit payment state
  const [creditCustomer, setCreditCustomer] = useState('');
  const [creditPhone, setCreditPhone] = useState('');
  const [creditStep, setCreditStep] = useState<'idle' | 'customer'>('idle');
  const [creditSuggestions, setCreditSuggestions] = useState<{ name: string; phone?: string }[]>([]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  useEffect(() => {
    if (selectedProduct) setUnitPrice(Number(selectedProduct.current_price));
  }, [selectedProduct]);

  // Escape key closes modals
  useEffect(() => {
    if (moncashStep === 'idle' && creditStep === 'idle') return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moncashStep !== 'idle') setMoncashStep('idle');
        else if (creditStep !== 'idle') setCreditStep('idle');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [moncashStep, creditStep]);

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
          if (data.quantity) setQuantity(Number(data.quantity));
          if (data.unit_price) setUnitPrice(Number(data.unit_price));
          if (data.product_name) {
            const match = products.find(
              (p) =>
                p.name.toLowerCase().includes(data.product_name!.toLowerCase()) ||
                p.name_creole?.toLowerCase().includes(data.product_name!.toLowerCase()),
            );
            if (match) setProductId(match.id);
          }
        }
      } catch (err) { console.warn('[Talisman] NLP parse failed:', err); }
    },
    [products],
  );

  const speech = useSpeechInput(handleVoiceResult);

  const handleSubmit = async () => {
    // Validate
    const newErrors: typeof errors = {};
    if (!productId) newErrors.product = t('validation.select_product');
    if (quantity <= 0) newErrors.quantity = t('validation.quantity_min');
    else if (selectedProduct && selectedProduct.stock_quantity > 0 && quantity > selectedProduct.stock_quantity) {
      newErrors.quantity = t('validation.stock_exceeded')
        .replace('{stock}', String(selectedProduct.stock_quantity))
        .replace('{unit}', selectedProduct.unit);
    }
    if (unitPrice <= 0) newErrors.price = t('validation.price_min');
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      submitRef.current?.classList.remove('animate-shake');
      void submitRef.current?.offsetWidth;
      submitRef.current?.classList.add('animate-shake');
      return;
    }
    setErrors({});

    // MonCash: ask for phone first
    if (paymentMethod === 'moncash' && moncashStep === 'idle') {
      setMoncashStep('phone');
      return;
    }
    // Credit: ask for customer first
    if (paymentMethod === 'credit' && creditStep === 'idle') {
      setCreditStep('customer');
      return;
    }

    setSaving(true);
    const numQty = Number(quantity);
    const numPrice = Number(unitPrice);
    const numTotal = Number(total);
    const apiPayload = {
      product_id: productId || null,
      transaction_type: 'SALE' as const,
      quantity: numQty.toFixed(2),
      unit_price: numPrice.toFixed(2),
      total_amount: numTotal.toFixed(2),
      payment_method: paymentMethod,
      recorded_offline: true,
    };
    try {
      const txnId = crypto.randomUUID();
      const localTxn: TransactionRecord = {
        id: txnId,
        vendor_id: vendor?.id ?? '',
        product_id: productId || undefined,
        transaction_type: 'SALE',
        quantity: numQty,
        unit_price: numPrice,
        total_amount: numTotal,
        payment_method: paymentMethod,
        recorded_offline: true,
        created_at: new Date().toISOString(),
        employee_id: currentEmployee?.role === 'owner' ? null : (currentEmployee?.id ?? null),
        employee_name: currentEmployee?.role === 'owner' ? null : (currentEmployee?.name ?? null),
      };
      await putInStore('transactions', localTxn);

      // Decrement stock locally
      let stockWarning = '';
      if (selectedProduct) {
        const newStock = Math.max(0, selectedProduct.stock_quantity - quantity);
        await putInStore('products', { ...selectedProduct, stock_quantity: newStock });
        if (selectedProduct.low_stock_threshold > 0 && newStock <= selectedProduct.low_stock_threshold) {
          stockWarning = t('stock.warning')
            .replace('{product}', selectedProduct.name)
            .replace('{remaining}', String(newStock))
            .replace('{unit}', selectedProduct.unit);
        }
      }

      // Credit: create credit entry for the customer
      if (paymentMethod === 'credit' && creditCustomer) {
        const creditEntry = {
          id: crypto.randomUUID(),
          vendor_id: vendor?.id ?? '',
          customer_name: creditCustomer,
          customer_phone: creditPhone || undefined,
          entry_type: 'CREDIT_GIVEN' as const,
          amount: numTotal,
          balance_after: numTotal,
          reminder_sent: false,
        };
        await putCreditEntrySecure(creditEntry);
        await upsertCustomer(creditCustomer, creditPhone || undefined, numTotal, false, vendor?.id);
        await enqueue({ endpoint: '/credit', method: 'POST', body: {
          customer_name: creditCustomer, customer_phone: creditPhone || null,
          entry_type: 'CREDIT_GIVEN', amount: numTotal.toFixed(2),
        }});
      }

      // MonCash: create payment record and show waiting screen
      if (paymentMethod === 'moncash') {
        const ref = `MC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
        setMoncashRef(ref);
        const mcPayment: MonCashPayment = {
          id: crypto.randomUUID(),
          transactionId: txnId,
          amount: total,
          currency: 'HTG',
          customerPhone: moncashPhone,
          vendorPhone: vendor?.phone_number ?? '',
          status: 'pending',
          createdAt: new Date().toISOString(),
          completedAt: null,
          moncashReference: ref,
        };
        await putInStore('moncashPayments', mcPayment);
        await enqueue({ endpoint: '/moncash/create', method: 'POST', body: { ...mcPayment } });
        setMoncashStep('waiting');
        setSaving(false);
        return; // Don't close yet — wait for manual confirmation
      }

      // Queue for sync
      await enqueue({ endpoint: '/transactions', method: 'POST', body: apiPayload });
      if (navigator.onLine) {
        api.post('/transactions', { ...apiPayload, recorded_offline: false }).catch(() => {});
      }

      completeSale(stockWarning);
    } catch (err) { console.error('[Talisman] Sale save failed:', err); } finally { setSaving(false); }
  };

  const completeSale = (stockWarning = '') => {
    // Success animation
    formRef.current?.classList.remove('animate-success-pop');
    void formRef.current?.offsetWidth;
    formRef.current?.classList.add('animate-success-pop');

    const prodName = selectedProduct?.name ?? '—';
    const receiptRecord: ReceiptRecord = { id: crypto.randomUUID(), vendor_id: vendor?.id ?? '', productName: prodName, quantity: Number(quantity), unitPrice: Number(unitPrice), total: Number(total), createdAt: new Date().toISOString() };
    putInStore('receipts', receiptRecord);

    const toastMsg = paymentMethod === 'moncash' ? t('payment.received')
      : paymentMethod === 'credit' ? t('payment.credit_recorded').replace('{name}', creditCustomer)
      : navigator.onLine ? t('message.sale_recorded') : t('status.saved_offline');
    showToast(toastMsg, navigator.onLine ? 'success' : 'offline');

    if (stockWarning) {
      setTimeout(() => showToast(stockWarning, 'warning'), 2000);
    }

    // Auto-stamp loyalty card for credit sales with a customer name
    if (paymentMethod === 'credit' && creditCustomer && vendor?.id) {
      stampLoyaltyCard(vendor.id, creditCustomer).catch((err) =>
        console.warn('[Talisman] Loyalty stamp failed:', err),
      );
    }

    // For inline (non-sheet) mode, show receipt inside SalesPage
    if (!isSheet) {
      setReceiptData({ product: prodName, qty: Number(quantity), price: Number(unitPrice), total: Number(total) });
    }

    setQuantity(1);
    setProductId('');
    setUnitPrice(0);
    setPaymentMethod('cash');
    setMoncashStep('idle');
    setMoncashPhone('+509');
    setCreditStep('idle');
    setCreditCustomer('');
    setCreditPhone('');
    setCreditSuggestions([]);
    refreshSales();

    // For sheet mode, close sheet and pass receipt data up to Layout
    if (isSheet && onComplete) {
      onComplete({ product: prodName, qty: Number(quantity), price: Number(unitPrice), total: Number(total) });
    }
  };

  const handleMoncashConfirm = async () => {
    // Queue the transaction for sync now that payment is confirmed
    await enqueue({ endpoint: '/transactions', method: 'POST', body: {
      product_id: productId || null, transaction_type: 'SALE', quantity: Number(quantity).toFixed(2),
      unit_price: Number(unitPrice).toFixed(2), total_amount: Number(total).toFixed(2),
      payment_method: 'moncash', moncash_reference: moncashRef, recorded_offline: true,
    }});
    completeSale();
  };

  const handleMoncashCancel = async () => {
    // Record the sale as cash (unpaid MonCash) — the transaction is already in IndexedDB
    await enqueue({ endpoint: '/transactions', method: 'POST', body: {
      product_id: productId || null, transaction_type: 'SALE', quantity: Number(quantity).toFixed(2),
      unit_price: Number(unitPrice).toFixed(2), total_amount: Number(total).toFixed(2),
      payment_method: 'cash', recorded_offline: true,
    }});
    setMoncashStep('idle');
    completeSale();
  };

  const handleCreditNameChange = async (v: string) => {
    setCreditCustomer(v);
    if (v.length < 2) { setCreditSuggestions([]); return; }
    try {
      const customers = await getAllCustomersSecure(vendor?.id);
      setCreditSuggestions(
        customers.filter((c) => c.name.toLowerCase().includes(v.toLowerCase())).slice(0, 5).map((c) => ({ name: c.name, phone: c.phone }))
      );
    } catch { setCreditSuggestions([]); }
  };

  function showToast(msg: string, variant: ToastVariant = 'success') {
    setToast(msg);
    setToastVariant(variant);
    setTimeout(() => setToast(''), 2500);
  }

  /** Auto-stamp a loyalty card after a credit sale for a named customer. */
  async function stampLoyaltyCard(vendorId: string, customerName: string) {
    const programs = await getVendorRecords('loyaltyPrograms', vendorId);
    const activeProgram = programs.find((p: LoyaltyProgramRecord) => p.is_active);
    if (!activeProgram) return; // no active loyalty program

    const allCards = await getVendorRecords('loyaltyCards', vendorId);
    let card = allCards.find(
      (c: LoyaltyCardRecord) => c.customer_name === customerName && c.program_id === activeProgram.id,
    );

    if (!card) {
      card = {
        id: crypto.randomUUID(),
        vendor_id: vendorId,
        customer_name: customerName,
        program_id: activeProgram.id,
        stamps: 0,
        rewards_earned: 0,
        last_stamp_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    }

    card.stamps += 1;
    card.last_stamp_date = new Date().toISOString();

    if (card.stamps >= activeProgram.required_purchases) {
      card.stamps = 0;
      card.rewards_earned += 1;
      await putInStore('loyaltyCards', card);
      setTimeout(
        () => showToast(t('loyalty.reward_unlocked').replace('{name}', customerName), 'success'),
        2500,
      );
    } else {
      await putInStore('loyaltyCards', card);
      setTimeout(
        () =>
          showToast(
            t('loyalty.stamp_added')
              .replace('{name}', customerName)
              .replace('{current}', String(card.stamps))
              .replace('{total}', String(activeProgram.required_purchases)),
            'success',
          ),
        2500,
      );
    }
  }

  return (
    <div className={isSheet ? "pt-2 space-y-4" : "space-y-5 animate-fade-up"}>
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
          <p className="text-sm text-secondary">{t('message.speech_not_supported')}</p>
        )}
        <p className="mt-3 text-sm text-secondary text-center">
          {speech.listening ? t('label.listening') : speech.transcript || t('label.voice_input')}
        </p>
      </section>

      {/* ── Sale form ── */}
      <section ref={formRef} className="card p-5 space-y-3">
        {/* Product dropdown */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">{t('label.product')}</label>
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
          {selectedProduct && (
            <>
              <p className="text-[13px] text-[var(--c-primary)] font-medium mt-1 animate-fade-in">
                {Number(selectedProduct.current_price).toLocaleString()} {t('label.currency')} / {selectedProduct.unit}
                {selectedProduct.stock_quantity != null && (
                  <span className="text-secondary ml-2">
                    — {t('search.stock')}: {selectedProduct.stock_quantity} {selectedProduct.unit}
                  </span>
                )}
              </p>
              {selectedProduct.stock_quantity === 0 && (
                <p className="text-[#E76F51] text-[12px] font-medium mt-1 animate-fade-in">
                  ⚠️ {t('validation.out_of_stock').replace('{unit}', selectedProduct.unit)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Quantity stepper */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
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
                quantity <= 1 ? 'bg-gray-100 text-gray-300 opacity-50' : 'bg-page text-[var(--c-primary)]'
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
              className={`flex-1 h-12 rounded-xl border text-center text-2xl font-heading font-bold text-primary focus:ring-2 focus:ring-[var(--c-primary)] focus:border-transparent ${
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
          <label className="block text-sm font-medium text-secondary mb-1">{t('label.price')} ({t('label.currency')})</label>
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

        {/* Payment method selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-secondary">{t('payment.method')}</label>
          <div className="flex gap-3">
            {([
              { id: 'cash' as const, label: t('payment.cash'), emoji: '💵', activeBorder: 'border-[var(--c-primary)]', activeBg: 'bg-[#F0FDF4]' },
              { id: 'moncash' as const, label: 'MonCash', emoji: '📱', activeBorder: 'border-[#F4A261]', activeBg: 'bg-[#FFF7ED]' },
              { id: 'credit' as const, label: t('payment.credit'), emoji: '📝', activeBorder: 'border-[#E76F51]', activeBg: 'bg-[#FEF2F2]' },
            ]).map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => { setPaymentMethod(pm.id); setMoncashStep('idle'); }}
                className={`flex-1 min-w-0 py-3 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all overflow-visible ${
                  paymentMethod === pm.id
                    ? `${pm.activeBg} border-2 ${pm.activeBorder}`
                    : 'bg-white border-2 border-transparent shadow-sm'
                }`}
              >
                <span className="text-2xl leading-none">{pm.emoji}</span>
                <span className="text-[13px] font-bold text-primary text-center whitespace-nowrap">{pm.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Total + Submit */}
        <div className="border-t border-dashed border-gray-200 -mx-5 px-5 pt-4 mt-2 bg-page/60 -mb-5 pb-5 rounded-b-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-secondary">{t('label.total')}</span>
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

      {/* ── MonCash Phone Entry ── */}
      {moncashStep === 'phone' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center md:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMoncashStep('idle')} />
          <div className="relative bg-card rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-4">
            <h3 className="font-heading text-xl font-bold text-center text-primary">📱 {t('payment.moncash_title')}</h3>
            <p className="text-sm text-secondary text-center">{t('payment.customer_phone')}</p>
            <div>
              <input
                type="tel"
                value={moncashPhone}
                onChange={(e) => setMoncashPhone(e.target.value)}
                className="input-field text-center text-lg"
                placeholder="+509 37XX XXXX"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between bg-page rounded-xl p-3">
              <span className="text-sm text-secondary">{t('label.total')}</span>
              <span className="font-heading font-bold text-lg text-[var(--c-primary)]">{total.toLocaleString()} {t('label.currency')}</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setMoncashStep('idle')}
                className="btn flex-1 h-12 rounded-xl bg-gray-100 text-secondary font-heading font-bold">
                {t('action.cancel')}
              </button>
              <button type="button" onClick={handleSubmit}
                disabled={moncashPhone.length < 12 || saving}
                className="btn flex-1 h-12 rounded-xl bg-[#F4A261] text-white font-heading font-bold shadow-md disabled:opacity-40">
                {saving ? t('label.loading') : t('action.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MonCash Waiting Screen ── */}
      {moncashStep === 'waiting' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-card rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-5 text-center">
            <h3 className="font-heading text-xl font-bold text-primary">📱 {t('payment.moncash_title')}</h3>
            <p className="text-sm text-secondary">{t('payment.waiting')}</p>

            <div className="bg-page rounded-2xl p-4 space-y-2 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('label.total')}</span>
                <span className="font-bold text-primary">{total.toLocaleString()} {t('label.currency')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('label.phone')}</span>
                <span className="font-bold text-primary">{moncashPhone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('payment.reference')}</span>
                <span className="font-mono font-bold text-[var(--c-primary)]">{moncashRef}</span>
              </div>
            </div>

            {/* Spinner */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-[#F4A261] rounded-full animate-spin" />
            </div>

            <p className="text-xs text-muted leading-relaxed">{t('payment.waiting_desc')}</p>

            <div className="flex gap-3">
              <button type="button" onClick={handleMoncashCancel}
                className="btn flex-1 h-12 rounded-xl bg-gray-100 text-secondary font-heading font-bold">
                {t('action.cancel')}
              </button>
              <button type="button" onClick={handleMoncashConfirm}
                className="btn flex-1 h-12 rounded-xl bg-emerald-500 text-white font-heading font-bold shadow-md gap-2">
                {t('payment.mark_paid')} ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credit Customer Entry ── */}
      {creditStep === 'customer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreditStep('idle')} />
          <div className="relative bg-card rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-4">
            <h3 className="font-heading text-xl font-bold text-center text-primary">📝 {t('payment.credit')}</h3>
            <div className="relative">
              <label className="block text-sm font-medium text-secondary mb-1">{t('label.customer_name')}</label>
              <input
                value={creditCustomer}
                onChange={(e) => handleCreditNameChange(e.target.value)}
                className="input-field"
                autoFocus
              />
              {creditSuggestions.length > 0 && (
                <ul className="absolute z-10 inset-x-0 bg-card border border-gray-200 rounded-xl mt-1 shadow-lg max-h-36 overflow-y-auto">
                  {creditSuggestions.map((s) => (
                    <li key={s.name} className="px-3 py-2.5 hover:bg-gray-50 cursor-pointer text-sm font-medium"
                      onClick={() => { setCreditCustomer(s.name); if (s.phone) setCreditPhone(s.phone); setCreditSuggestions([]); }}>
                      {s.name} {s.phone && <span className="text-muted">({s.phone})</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">{t('label.customer_phone')}</label>
              <input type="tel" value={creditPhone} onChange={(e) => setCreditPhone(e.target.value)} className="input-field" />
            </div>
            <div className="flex items-center justify-between bg-page rounded-xl p-3">
              <span className="text-sm text-secondary">{t('label.total')}</span>
              <span className="font-heading font-bold text-lg text-[#E76F51]">{total.toLocaleString()} {t('label.currency')}</span>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreditStep('idle')}
                className="btn flex-1 h-12 rounded-xl bg-gray-100 text-secondary font-heading font-bold">
                {t('action.cancel')}
              </button>
              <button type="button" onClick={handleSubmit}
                disabled={creditCustomer.length < 2 || saving}
                className="btn flex-1 h-12 rounded-xl bg-[#E76F51] text-white font-heading font-bold shadow-md disabled:opacity-40">
                {saving ? t('label.loading') : `${t('action.record_sale')} 📝`}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-secondary text-base">{t('label.no_sales_today')}</p>
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
                <button type="button" onClick={() => { localStorage.setItem('tlsm_voice_tip_dismissed', '1'); setVoiceTipDismissed(true); }}
                  className="p-1 flex-shrink-0 -mt-1 -mr-1" aria-label={t('aria.close')}>
                  <RiCloseLine className="h-4 w-4 text-[#1E40AF]/50" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sales.map((s, i) => {
              const product = resolveProduct(s.product_id);
              const productLabel = product
                ? (product.is_active === false ? `${product.name} ${t('reports.archived_suffix')}` : product.name)
                : (s.product_id ? t('reports.unknown_product') : '—');
              return (
                <div key={s.id} className="card px-4 py-3 flex items-center justify-between animate-card-appear" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="min-w-0">
                    <p className="font-medium text-primary text-base truncate">{productLabel}</p>
                    <p className="text-xs text-secondary flex items-center gap-1.5">
                      {s.quantity} x {s.unit_price} {t('label.currency')}
                      {s.payment_method === 'moncash' && <span className="text-[10px] font-bold bg-[#FFF7ED] text-[#F4A261] px-1.5 py-0.5 rounded-full">📱 MC</span>}
                      {s.payment_method === 'credit' && <span className="text-[10px] font-bold bg-[#FEF2F2] text-[#E76F51] px-1.5 py-0.5 rounded-full">📝</span>}
                      {s.recorded_offline && <span className="text-[#F4A261]">({t('label.offline_tag')})</span>}
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
