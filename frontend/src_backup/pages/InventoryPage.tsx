import { useCallback, useMemo, useRef, useState, useEffect, type FormEvent } from 'react';
import { RiSearchLine, RiAddLine, RiCloseLine, RiAlertFill } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useProducts } from '../hooks/useProducts';
import { useSyncStore } from '../stores/syncStore';
import Toast from '../components/Toast';
import api from '../services/api';
import { putInStore, type ProductRecord } from '../services/db';

const UNITS = ['mamit', 'sak', 'douzèn', 'pyès', 'liv', 'galon'] as const;
const UNIT_KEYS: Record<string, string> = {
  mamit: 'unit.mamit', sak: 'unit.sak', 'douzèn': 'unit.douzen',
  'pyès': 'unit.pyes', liv: 'unit.liv', galon: 'unit.galon',
};

export default function InventoryPage() {
  const { t } = useI18n();
  const { products, loading, refresh } = useProducts();
  const enqueue = useSyncStore((s) => s.enqueue);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'active'>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const filtered = useMemo(() => {
    let list = products;
    if (filter === 'low_stock') list = list.filter((p) => p.stock_quantity < p.low_stock_threshold);
    else if (filter === 'active') list = list.filter((p) => p.is_active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.name_creole?.toLowerCase().includes(q));
    }
    return list;
  }, [products, search, filter]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('message.confirm_delete'))) return;
    try {
      if (navigator.onLine) await api.delete(`/products/${id}`);
      else await enqueue({ endpoint: `/products/${id}`, method: 'DELETE', body: null });
      showToast(t('message.product_deleted'));
      refresh();
    } catch (err) { console.error('[MarketMama] Product delete failed:', err); }
  };

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4 animate-fade-up">
      <Toast msg={toast} />

      {/* Search */}
      <div className="relative">
        <RiSearchLine className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('action.search')}
          className="w-full h-12 pl-11 pr-4 rounded-full border border-gray-200 text-base font-body bg-white focus:ring-2 focus:ring-[var(--c-primary)] focus:border-transparent transition-shadow"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['all', 'low_stock', 'active'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[var(--c-primary)] text-white shadow-sm'
                : `bg-white text-[var(--c-text2)] border border-gray-200 ${products.length === 0 ? 'opacity-60' : ''}`
            }`}>
            {t(`filter.${f}`)}
          </button>
        ))}
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-4">
          <p className="text-5xl">📦</p>
          <p className="text-[var(--c-text2)] text-base">{t('message.no_products')}</p>
          <button
            type="button"
            onClick={() => { setEditId(null); setSheetOpen(true); }}
            className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md gap-2"
          >
            <RiAddLine className="h-5 w-5" />
            {t('message.no_products_cta')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} t={t}
              onEdit={() => { setEditId(p.id); setSheetOpen(true); }}
              onDelete={() => handleDelete(p.id)} />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => { setEditId(null); setSheetOpen(true); }}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full gradient-primary text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40"
        aria-label={t('action.add_product')}
      >
        <RiAddLine className="h-7 w-7" />
      </button>

      {/* Bottom sheet */}
      {sheetOpen && (
        <ProductSheet
          editId={editId} products={products} t={t}
          onClose={() => { setSheetOpen(false); setEditId(null); }}
          onSaved={(msg) => { setSheetOpen(false); setEditId(null); showToast(msg); refresh(); }}
          enqueue={enqueue}
        />
      )}
    </div>
  );
}

/* ── Product card ── */

function ProductCard({ product: p, t, onEdit, onDelete }: {
  product: ProductRecord; t: (k: string) => string; onEdit: () => void; onDelete: () => void;
}) {
  const lowStock = p.stock_quantity < p.low_stock_threshold;
  const pct = p.low_stock_threshold > 0
    ? Math.min(100, (p.stock_quantity / p.low_stock_threshold) * 100)
    : 100;
  const barColor = pct > 60 ? 'bg-emerald-500' : pct > 30 ? 'bg-[#FFD166]' : 'bg-[#E76F51]';

  const [swiped, setSwiped] = useState(false);
  const startX = useRef(0);

  return (
    <div className="relative overflow-hidden rounded-2xl"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx < -60) setSwiped(true);
        else if (dx > 40) setSwiped(false);
      }}
    >
      {swiped && (
        <button type="button" onClick={() => { setSwiped(false); onDelete(); }}
          className="absolute right-0 inset-y-0 w-20 bg-[#E76F51] text-white flex items-center justify-center font-bold text-sm z-10">
          {t('action.delete')}
        </button>
      )}
      <div
        className={`card p-4 transition-transform ${swiped ? '-translate-x-20' : ''}`}
        onClick={() => !swiped && onEdit()}
        role="button" tabIndex={0}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-base text-[var(--c-text)] truncate">
              {p.name}
              {p.name_creole && <span className="font-body font-normal text-[var(--c-text2)] ml-1">({p.name_creole})</span>}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-[var(--c-text2)] whitespace-nowrap">{p.stock_quantity} {p.unit}</span>
              {lowStock && <RiAlertFill className="h-4 w-4 text-[#E76F51] flex-shrink-0" />}
            </div>
          </div>
          <div className="ml-3 text-right flex-shrink-0">
            <p className="font-heading font-bold text-lg text-[var(--c-primary)] whitespace-nowrap">
              {Number(p.current_price).toLocaleString()} {t('label.currency')}
            </p>
            {p.cost_price != null && p.cost_price > 0 && (() => {
              const margin = ((p.current_price - p.cost_price) / p.current_price) * 100;
              const color = margin >= 20 ? 'text-emerald-600 bg-emerald-50' : margin >= 10 ? 'text-[#F4A261] bg-orange-50' : 'text-[#E76F51] bg-red-50';
              return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{t('label.margin')}: {margin.toFixed(1)}%</span>;
            })()}
            {p.stock_quantity === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-[#E76F51] bg-red-50 ml-1">{t('label.out_of_stock')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Product sheet ── */

function ProductSheet({ editId, products, t, onClose, onSaved, enqueue }: {
  editId: string | null; products: ProductRecord[];
  t: (k: string) => string; onClose: () => void;
  onSaved: (msg: string) => void;
  enqueue: (item: { endpoint: string; method: 'POST' | 'PATCH' | 'DELETE'; body: unknown }) => Promise<void>;
}) {
  const existing = editId ? products.find((p) => p.id === editId) : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [nameCreole, setNameCreole] = useState(existing?.name_creole ?? '');
  const [unit, setUnit] = useState(existing?.unit ?? 'mamit');
  const [price, setPrice] = useState(existing?.current_price?.toString() ?? '');
  const [costPrice, setCostPrice] = useState(existing?.cost_price?.toString() ?? '');
  const [stock, setStock] = useState(existing?.stock_quantity?.toString() ?? '');
  const [threshold, setThreshold] = useState(existing?.low_stock_threshold?.toString() ?? '5');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name); setNameCreole(existing.name_creole ?? '');
      setUnit(existing.unit); setPrice(existing.current_price.toString());
      setCostPrice(existing.cost_price?.toString() ?? '');
      setStock(existing.stock_quantity.toString()); setThreshold(existing.low_stock_threshold.toString());
    }
  }, [existing]);

  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    setSaving(true);
    setError('');
    const apiPayload = { name, name_creole: nameCreole || null, unit, current_price: price, cost_price: costPrice || null, stock_quantity: stock || '0', low_stock_threshold: threshold || '5' };
    try {
      if (editId) {
        // Offline-first: write to IndexedDB immediately
        const localProduct: ProductRecord = { ...existing!, ...apiPayload, current_price: Number(price), cost_price: costPrice ? Number(costPrice) : undefined, stock_quantity: Number(stock || '0'), low_stock_threshold: Number(threshold || '5') };
        await putInStore('products', localProduct);
        onSaved(t('message.product_updated'));
        // Background sync
        await enqueue({ endpoint: `/products/${editId}`, method: 'PATCH', body: apiPayload });
        if (navigator.onLine) {
          try {
            const { data } = await api.patch<ProductRecord>(`/products/${editId}`, apiPayload);
            await putInStore('products', data); // overwrite with server version
          } catch (err) { console.warn('[MarketMama] Background sync failed, queued for retry:', err); }
        }
      } else {
        // Offline-first: write to IndexedDB immediately with local UUID
        const localProduct: ProductRecord = {
          id: crypto.randomUUID(),
          vendor_id: '',
          name,
          name_creole: nameCreole || undefined,
          unit,
          current_price: Number(price),
          cost_price: costPrice ? Number(costPrice) : undefined,
          stock_quantity: Number(stock || '0'),
          low_stock_threshold: Number(threshold || '5'),
          is_active: true,
        };
        await putInStore('products', localProduct);
        onSaved(t('message.product_added'));
        // Background sync
        await enqueue({ endpoint: '/products', method: 'POST', body: apiPayload });
        if (navigator.onLine) {
          try {
            const { data } = await api.post<ProductRecord>('/products', apiPayload);
            await putInStore('products', data); // overwrite with server version (has real vendor_id)
          } catch (err) { console.warn('[MarketMama] Background sync failed, queued for retry:', err); }
        }
      }
    } catch (err) {
      console.error('Product save failed:', err);
      setError(t('message.save_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto safe-area-pb animate-slide-up">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading text-xl font-bold">{editId ? t('action.edit') : t('action.add_product')}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100" aria-label={t('aria.close')}><RiCloseLine className="h-6 w-6 text-gray-400" /></button>
        </div>
        <Field label={t('label.product_name')} required><input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required /></Field>
        <Field label={t('label.product_name_creole')}><input value={nameCreole} onChange={(e) => setNameCreole(e.target.value)} className="input-field" /></Field>
        <Field label={t('label.unit')}><select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-field">{UNITS.map((u) => <option key={u} value={u}>{t(UNIT_KEYS[u] ?? u)}</option>)}</select></Field>
        <Field label={`${t('label.current_price')} (${t('label.currency')})`} required><input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="input-field" min={0} required /></Field>
        <Field label={`${t('label.cost_price')} (${t('label.currency')})`}><input type="number" inputMode="decimal" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="input-field" min={0} placeholder="—" /></Field>
        <Field label={editId ? t('label.stock') : t('label.initial_stock')}><input type="number" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} className="input-field" min={0} /></Field>
        <Field label={t('label.low_stock_threshold')}><input type="number" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="input-field" min={0} /></Field>
        {error && <p className="text-[#E76F51] text-sm font-medium text-center animate-fade-in">{error}</p>}
        <button type="submit" disabled={saving || !name || !price} className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40">
          {saving ? t('label.loading') : t('action.save')}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">
        {label}{required && <span className="text-[#E76F51] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
