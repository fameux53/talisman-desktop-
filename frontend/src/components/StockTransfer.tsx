import { useState, useEffect } from 'react';
import { useI18n } from '../i18n';
import { getVendorRecords, putInStore, type ProductRecord, type LocationRecord, type LocationStockRecord } from '../services/db';

interface StockTransferProps {
  product: ProductRecord;
  locations: LocationRecord[];
  vendorId: string;
  onClose: () => void;
  onComplete: (message: string) => void;
}

export default function StockTransfer({ product, locations, vendorId, onClose, onComplete }: StockTransferProps) {
  const { t } = useI18n();

  const [fromLocationId, setFromLocationId] = useState(locations[0]?.id ?? '');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationStocks, setLocationStocks] = useState<LocationStockRecord[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Load location stock records for this product
  useEffect(() => {
    (async () => {
      const allStock = await getVendorRecords('locationStock', vendorId);
      const forProduct = allStock.filter((ls) => ls.product_id === product.id);
      setLocationStocks(forProduct);
    })();
  }, [vendorId, product.id]);

  const getStockForLocation = (locationId: string): number => {
    const record = locationStocks.find((ls) => ls.location_id === locationId);
    return record?.stock_quantity ?? 0;
  };

  const availableStock = getStockForLocation(fromLocationId);
  const qty = Number(quantity) || 0;

  const validate = (): string => {
    if (!fromLocationId) return 'locations.from';
    if (!toLocationId) return 'locations.select_destination';
    if (fromLocationId === toLocationId) return 'locations.select_destination';
    if (qty <= 0) return 'validation.quantity_min';
    if (qty > availableStock) {
      return t('locations.not_enough_stock')
        .replace('{available}', String(availableStock))
        .replace('{unit}', product.unit);
    }
    return '';
  };

  const handleConfirm = async () => {
    const validationError = validate();
    if (validationError) {
      // If it's already a translated string (from not_enough_stock), use it directly
      setError(validationError.startsWith('locations.') || validationError.startsWith('validation.')
        ? t(validationError) : validationError);
      return;
    }

    setSubmitting(true);
    try {
      // Decrement stock at source
      const sourceRecord = locationStocks.find((ls) => ls.location_id === fromLocationId);
      if (sourceRecord) {
        await putInStore('locationStock', {
          ...sourceRecord,
          stock_quantity: sourceRecord.stock_quantity - qty,
        });
      }

      // Increment stock at destination
      const destRecord = locationStocks.find((ls) => ls.location_id === toLocationId);
      if (destRecord) {
        await putInStore('locationStock', {
          ...destRecord,
          stock_quantity: destRecord.stock_quantity + qty,
        });
      } else {
        // Create a new locationStock record for destination
        await putInStore('locationStock', {
          id: crypto.randomUUID(),
          location_id: toLocationId,
          product_id: product.id,
          stock_quantity: qty,
          low_stock_threshold: 0,
        });
      }

      const destLocation = locations.find((l) => l.id === toLocationId);
      const successMsg = t('locations.transfer_success')
        .replace('{qty}', String(qty))
        .replace('{unit}', product.unit)
        .replace('{location}', destLocation?.name ?? '');

      onComplete(successMsg);
    } catch {
      setError(t('error.save_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-6 w-[90%] max-w-md mx-auto space-y-5 animate-fade-in">
        <h3 className="font-heading text-lg font-bold text-center text-[var(--c-text)]">
          {t('locations.transfer')} — {product.name}
        </h3>

        {/* From location */}
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('locations.from')}</label>
          <select
            value={fromLocationId}
            onChange={(e) => { setFromLocationId(e.target.value); setError(''); }}
            className="input-field w-full"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({getStockForLocation(loc.id)} {product.unit})
              </option>
            ))}
          </select>
        </div>

        {/* To location */}
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('locations.to')}</label>
          <select
            value={toLocationId}
            onChange={(e) => { setToLocationId(e.target.value); setError(''); }}
            className="input-field w-full"
          >
            <option value="">{t('locations.select_destination')}</option>
            {locations.filter((loc) => loc.id !== fromLocationId).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({getStockForLocation(loc.id)} {product.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('label.quantity')}</label>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); setError(''); }}
            className="input-field w-full text-center text-xl font-bold"
            placeholder="0"
          />
          <p className="text-xs text-[var(--c-muted)] mt-1">
            {availableStock} {product.unit} {t('filter.available') || 'available'}
          </p>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-gray-200 text-[var(--c-text)] font-heading font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            {t('action.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !toLocationId || qty <= 0}
            className="flex-1 h-12 rounded-xl gradient-primary text-white font-heading font-bold text-sm shadow-md disabled:opacity-40 transition-opacity"
          >
            {t('locations.confirm_transfer')}
          </button>
        </div>
      </div>
    </div>
  );
}
