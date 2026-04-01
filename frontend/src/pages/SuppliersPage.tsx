import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import { RiAddLine, RiCloseLine, RiMapPinLine, RiPhoneLine, RiArrowRightSLine, RiSearchLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { getVendorRecords, getAllFromStore, putInStore, type SupplierRecord, type SupplierPriceRecord } from '../services/db';
import { useAuthStore } from '../stores/authStore';
import Toast from '../components/Toast';

export default function SuppliersPage() {
  const { t } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [prices, setPrices] = useState<SupplierPriceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    const [s, p] = await Promise.all([getVendorRecords('suppliers', vendorId), getAllFromStore('supplierPrices')]);
    setSuppliers(s);
    setPrices(p);
    setLoading(false);
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (!search) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q));
  }, [suppliers, search]);

  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prices) {
      map.set(p.supplierId, (map.get(p.supplierId) ?? 0) + 1);
    }
    return map;
  }, [prices]);

  const selectedSupplier = useMemo(() => suppliers.find((s) => s.id === selectedId) ?? null, [suppliers, selectedId]);
  const selectedPrices = useMemo(() => prices.filter((p) => p.supplierId === selectedId), [prices, selectedId]);

  // For best-price badge: find the minimum price per product across all suppliers
  const bestPriceMap = useMemo(() => {
    const byProduct = new Map<string, number[]>();
    for (const p of prices) {
      const arr = byProduct.get(p.productId) ?? [];
      arr.push(p.price);
      byProduct.set(p.productId, arr);
    }
    const minMap = new Map<string, number>();
    for (const [productId, priceList] of byProduct) {
      if (priceList.length >= 2) {
        minMap.set(productId, Math.min(...priceList));
      }
    }
    return minMap;
  }, [prices]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />

      <h1 className="font-heading text-xl font-bold text-primary">{t('suppliers.title')}</h1>

      {/* Search */}
      <div className="relative">
        <RiSearchLine className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('action.search')}
          className="w-full h-12 pl-11 pr-4 rounded-full bg-white shadow-sm text-sm text-primary font-body border border-gray-200 focus:ring-2 focus:ring-brand-green-500 focus:border-transparent" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : filtered.length === 0 && !search ? (
        <div className="card p-8 text-center space-y-3">
          <p className="text-5xl">🏪</p>
          <p className="text-secondary text-sm leading-relaxed">{t('suppliers.no_suppliers')}</p>
          <button type="button" onClick={() => setSheetOpen(true)}
            className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md gap-2">
            <RiAddLine className="h-5 w-5" /> {t('suppliers.add')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
              className={`card p-4 flex items-center gap-3 active:scale-[0.98] transition-all cursor-pointer ${selectedId === s.id ? 'ring-2 ring-[var(--c-primary)]' : ''}`}>
              <div className="w-11 h-11 rounded-full bg-[var(--c-primary)] text-white flex items-center justify-center font-heading text-lg font-bold flex-shrink-0">
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-[15px] text-primary truncate">{s.name}</p>
                <div className="flex items-center gap-3 text-xs text-secondary">
                  {s.location && <span className="flex items-center gap-1"><RiMapPinLine className="h-3 w-3" /> {s.location}</span>}
                  <span>{productCountMap.get(s.id) ?? 0} {t('suppliers.products')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {s.phone && (
                  <a href={`tel:${s.phone}`} onClick={(e) => e.stopPropagation()}
                    className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <RiPhoneLine className="h-4 w-4" />
                  </a>
                )}
                <RiArrowRightSLine className={`h-5 w-5 text-gray-300 transition-transform ${selectedId === s.id ? 'rotate-90' : ''}`} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded detail for selected supplier */}
      {selectedSupplier && selectedPrices.length > 0 && (
        <div className="card p-4 space-y-2 animate-fade-in">
          <p className="font-heading font-bold text-sm text-primary">{t('suppliers.supplier_prices')}</p>
          {selectedPrices.map((sp) => {
            const isBestPrice = bestPriceMap.has(sp.productId) && sp.price <= bestPriceMap.get(sp.productId)!;
            return (
              <div key={sp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-primary">{sp.productId.slice(0, 8)}...</span>
                <div className="flex items-center gap-2">
                  {isBestPrice && (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {t('suppliers.best_price')} ✓
                    </span>
                  )}
                  <span className="text-sm font-bold text-[var(--c-primary)]">{sp.price.toLocaleString()} {t('label.currency')}/{sp.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button type="button" onClick={() => setSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform z-40 gradient-primary">
        <RiAddLine className="h-7 w-7" />
      </button>

      {/* Add supplier sheet */}
      {sheetOpen && (
        <SupplierSheet t={t} vendorId={vendorId} onClose={() => setSheetOpen(false)}
          onSaved={(name) => { setSheetOpen(false); showToast(`${name} ${t('message.product_added').toLowerCase()}`); refresh(); }} />
      )}
    </div>
  );
}

function SupplierSheet({ t, onClose, onSaved, vendorId }: {
  t: (k: string) => string; onClose: () => void; onSaved: (name: string) => void; vendorId: string;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError(t('validation.name_required')); return; }
    setNameError('');
    setSaving(true);
    const supplier: SupplierRecord = {
      id: crypto.randomUUID(),
      vendor_id: vendorId,
      name: name.trim(),
      phone: phone.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
    };
    await putInStore('suppliers', supplier);
    onSaved(supplier.name);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading text-xl font-bold text-primary">{t('suppliers.add')}</h3>
          <button type="button" onClick={onClose} className="p-1.5"><RiCloseLine className="h-6 w-6 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">{t('suppliers.name')} <span className="text-[#E76F51]">*</span></label>
          <input value={name} onChange={(e) => { setName(e.target.value); setNameError(''); }}
            className={`input-field ${nameError ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`} autoFocus />
          {nameError && <p className="text-[#E76F51] text-[13px] mt-1 animate-fade-in">{nameError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">{t('suppliers.phone')}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">{t('suppliers.location')}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="input-field" placeholder="Croix-des-Bossales, Tabarre..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">{t('suppliers.notes')}</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" />
        </div>
        <button type="submit" disabled={saving || !name.trim()}
          className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40">
          {saving ? t('label.loading') : t('action.save')}
        </button>
      </form>
    </div>
  );
}
