import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiCheckLine, RiArrowRightLine, RiFileListLine } from 'react-icons/ri';
import { useI18n, type Locale } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { putInStore, type ProductRecord, getAllFromStore } from '../services/db';
import Toast from '../components/Toast';
import { CATEGORIES, STARTER_PRODUCTS, type CatalogProduct } from '../data/starterCatalog';

function getSetupDoneKey(vendorId?: string): string {
  return vendorId ? `tlsm_catalog_setup_done_${vendorId}` : 'tlsm_catalog_setup_done';
}

export function isCatalogSetupDone(vendorId?: string): boolean {
  return localStorage.getItem(getSetupDoneKey(vendorId)) === 'true';
}

function getCategoryLabel(cat: typeof CATEGORIES[number], locale: Locale) {
  if (locale === 'fr') return cat.labelFR;
  if (locale === 'en') return cat.labelEN;
  return cat.labelHT;
}

function getProductName(p: CatalogProduct, locale: Locale) {
  if (locale === 'fr') return p.nameFR;
  if (locale === 'en') return p.nameEN;
  return p.nameHT;
}

export default function CatalogSetupPage({ existingProductNames, onDone }: {
  existingProductNames?: Set<string>;
  onDone?: () => void;
}) {
  const { t, locale } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);
  const enqueue = useSyncStore((s) => s.enqueue);
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, { price: number; stock: number }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const isRevisit = !!existingProductNames;

  const filteredProducts = useMemo(() => {
    if (!activeCategory) return STARTER_PRODUCTS;
    return STARTER_PRODUCTS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const categoryProducts = useMemo(() => {
    if (!activeCategory) return null;
    return STARTER_PRODUCTS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const allInCategorySelected = useMemo(() => {
    if (!categoryProducts) return false;
    return categoryProducts.every((p) => selected.has(p.id) || existingProductNames?.has(p.nameHT.toLowerCase()));
  }, [categoryProducts, selected, existingProductNames]);

  const toggleProduct = useCallback((p: CatalogProduct) => {
    if (existingProductNames?.has(p.nameHT.toLowerCase())) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, { price: p.suggestedPrice, stock: 0 });
      return next;
    });
  }, [existingProductNames]);

  const toggleAllInCategory = useCallback(() => {
    if (!categoryProducts) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (allInCategorySelected) {
        categoryProducts.forEach((p) => next.delete(p.id));
      } else {
        categoryProducts.forEach((p) => {
          if (!existingProductNames?.has(p.nameHT.toLowerCase())) {
            next.set(p.id, { price: p.suggestedPrice, stock: 0 });
          }
        });
      }
      return next;
    });
  }, [categoryProducts, allInCategorySelected, existingProductNames]);

  const updatePrice = useCallback((id: string, price: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, price });
      return next;
    });
  }, []);

  const updateStock = useCallback((id: string, stock: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry) next.set(id, { ...entry, stock });
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const products: ProductRecord[] = [];
      for (const [catalogId, entry] of selected) {
        const cp = STARTER_PRODUCTS.find((p) => p.id === catalogId);
        if (!cp) continue;
        const product: ProductRecord = {
          id: crypto.randomUUID(),
          vendor_id: vendor?.id ?? '',
          name: getProductName(cp, locale),
          name_creole: cp.nameHT,
          unit: cp.unit,
          current_price: entry.price,
          stock_quantity: entry.stock,
          low_stock_threshold: ({
            mamit: 3, sak: 2, 'douzèn': 2, liv: 5, 'boutèy': 5, 'pyès': 10,
            'pakèt': 5, bwat: 3, galon: 2, rejim: 2, 'vè': 10, sache: 20,
          } as Record<string, number>)[cp.unit] ?? 5,
          is_active: true,
        };
        products.push(product);
      }

      for (const p of products) {
        await putInStore('products', p);
        await enqueue({
          endpoint: '/products',
          method: 'POST',
          body: {
            name: p.name,
            name_creole: p.name_creole,
            unit: p.unit,
            current_price: String(p.current_price),
            stock_quantity: String(p.stock_quantity),
            low_stock_threshold: String(p.low_stock_threshold),
          },
        });
      }

      localStorage.setItem(getSetupDoneKey(vendor?.id), 'true');
      const msg = t('catalog.success').replace('{count}', String(products.length));
      setToast(msg);
      setTimeout(() => {
        if (onDone) onDone();
        else navigate('/', { replace: true });
      }, 2500);
    } catch (err) {
      console.error('[Talisman] Catalog setup failed:', err);
      setToast(t('error.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const welcomeText = t('catalog.welcome').replace('{name}', vendor?.display_name ?? '');
  const selectedCount = selected.size === 1
    ? t('catalog.product_selected_one')
    : t('catalog.products_selected').replace('{count}', String(selected.size));

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col">
      <Toast msg={toast} />

      {/* Header */}
      <div className="gradient-primary px-5 pt-8 pb-6 text-white">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🎉</span>
          <h1 className="font-heading text-xl font-extrabold">{welcomeText}</h1>
        </div>
        <p className="text-white/70 text-sm max-w-[340px]">{t('catalog.subtitle')}</p>
      </div>

      {/* Category pills */}
      <div className="relative -mt-4">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`h-9 px-5 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              activeCategory === null
                ? 'gradient-primary text-white shadow-md'
                : 'bg-white/90 text-[var(--c-text2)] border border-gray-200 hover:bg-white'
            }`}
          >
            {t('catalog.all_categories')}
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'gradient-primary text-white shadow-md'
                  : 'bg-white/90 text-[var(--c-text2)] border border-gray-200 hover:bg-white'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{getCategoryLabel(cat, locale)}</span>
            </button>
          ))}
        </div>
        {/* Scroll fade hint */}
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[var(--c-bg)] to-transparent pointer-events-none" />
      </div>

      {/* Select all toggle for active category */}
      {activeCategory && (
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={toggleAllInCategory}
            className="text-sm font-medium text-[var(--c-primary)] flex items-center gap-1"
          >
            {allInCategorySelected ? t('catalog.deselect_all') : t('catalog.select_all')}
          </button>
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((p) => {
            const isAlreadyAdded = existingProductNames?.has(p.nameHT.toLowerCase()) ?? false;
            const isSelected = selected.has(p.id);
            const selectedEntry = selected.get(p.id);
            const customPrice = selectedEntry?.price ?? p.suggestedPrice;
            const customStock = selectedEntry?.stock ?? 0;

            return (
              <div
                key={p.id}
                onClick={() => toggleProduct(p)}
                role="button"
                tabIndex={0}
                className={`card p-4 transition-all cursor-pointer relative ${
                  isAlreadyAdded
                    ? 'opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'ring-2 ring-[var(--c-primary)] bg-[#F0FDF4] shadow-lg scale-[1.02]'
                    : 'active:scale-[0.97]'
                }`}
              >
                {/* Check badge */}
                {(isSelected || isAlreadyAdded) && (
                  <div className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-sm ${
                    isAlreadyAdded ? 'bg-gray-400' : 'gradient-primary'
                  }`}>
                    <RiCheckLine className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Emoji icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-[32px] mb-2 mx-auto ${
                  isSelected ? 'bg-[#D1FAE5] ring-1 ring-emerald-300' : 'bg-gray-50'
                }`}>
                  {p.emoji}
                </div>

                <p className="font-heading font-semibold text-[14px] text-[var(--c-text)] leading-tight line-clamp-2">
                  {getProductName(p, locale)}
                </p>

                {isAlreadyAdded ? (
                  <p className="text-[11px] text-gray-400 mt-1">{t('catalog.already_added')}</p>
                ) : isSelected ? (
                  <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={customPrice}
                        onChange={(e) => updatePrice(p.id, Number(e.target.value) || 0)}
                        className="w-full h-7 text-[13px] px-2 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[var(--c-primary)] focus:border-transparent"
                      />
                      <span className="text-[11px] text-[var(--c-muted)] font-medium flex-shrink-0">G</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={customStock || ''}
                        placeholder="0"
                        onChange={(e) => updateStock(p.id, Number(e.target.value) || 0)}
                        className="w-full h-7 text-[13px] px-2 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[var(--c-primary)] focus:border-transparent"
                      />
                      <span className="text-[11px] text-[var(--c-muted)] font-medium flex-shrink-0">{t('catalog.initial_stock')}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] font-bold text-[var(--c-primary)] mt-1">
                    {p.suggestedPrice} G <span className="text-[11px] font-normal text-[var(--c-muted)]">/ {p.unit}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bulk import link */}
        {!isRevisit && (
          <button
            type="button"
            onClick={() => navigate('/import')}
            className="w-full mt-6 py-3 text-sm font-medium text-[var(--c-primary)] flex items-center justify-center gap-2 bg-white rounded-2xl border border-gray-200"
          >
            <RiFileListLine className="h-5 w-5" />
            {t('catalog.or_import')}
          </button>
        )}

        {/* Skip link */}
        {!isRevisit && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(getSetupDoneKey(vendor?.id), 'true');
              if (onDone) onDone();
              else navigate('/', { replace: true });
            }}
            className="w-full mt-2 py-3 text-sm text-[var(--c-muted)] underline underline-offset-2"
          >
            {t('catalog.skip')}
          </button>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 safe-area-pb z-40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--c-text)]">{selectedCount}</p>
            {selected.size > 0 && (
              <div className="flex gap-1 mt-1 overflow-hidden">
                {Array.from(selected.keys()).slice(0, 6).map((id) => {
                  const sp = STARTER_PRODUCTS.find((pr) => pr.id === id);
                  return sp ? <span key={id} className="text-lg flex-shrink-0">{sp.emoji}</span> : null;
                })}
                {selected.size > 6 && <span className="text-xs text-[var(--c-muted)] self-center ml-1">+{selected.size - 6}</span>}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={selected.size === 0 || saving}
            onClick={handleSubmit}
            className="btn h-12 px-6 rounded-2xl gradient-primary text-white font-heading font-bold text-[15px] shadow-lg disabled:opacity-40 gap-2 flex-shrink-0"
          >
            {saving ? t('label.loading') : t('catalog.add_to_inventory')}
            <RiArrowRightLine className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
