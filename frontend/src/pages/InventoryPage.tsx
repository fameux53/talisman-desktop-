import { useMemo, useRef, useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { RiSearchLine, RiAddLine, RiCloseLine, RiAlertLine, RiBookOpenLine, RiFileListLine, RiLayoutGridLine, RiArchiveLine, RiInboxUnarchiveLine, RiDeleteBin6Line, RiMore2Fill, RiPencilLine, RiFileCopyLine, RiSubtractLine, RiSettings3Line, RiArrowLeftRightLine } from 'react-icons/ri';
import { useI18n, type Locale } from '../i18n';
import { useProducts } from '../hooks/useProducts';
import { useSyncStore } from '../stores/syncStore';
import { type ToastVariant } from '../components/Toast';
import api from '../services/api';
import { putInStore, getVendorRecords, deleteFromStore, type ProductRecord, type TransactionRecord, type SupplierRecord, type SupplierPriceRecord } from '../services/db';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import StockTransfer from '../components/StockTransfer';
import { useLinkedNotes } from '../hooks/useLinkedNotes';
import { CATEGORIES } from '../data/starterCatalog';
import { STARTER_PRODUCTS } from '../data/starterCatalog';

const UNITS = ['mamit', 'sak', 'douzèn', 'pyès', 'liv', 'galon'] as const;
const UNIT_KEYS: Record<string, string> = {
  mamit: 'unit.mamit', sak: 'unit.sak', 'douzèn': 'unit.douzen',
  'pyès': 'unit.pyes', liv: 'unit.liv', galon: 'unit.galon',
};

const CATEGORY_BG: Record<string, string> = {
  grains: 'bg-amber-50', legumes: 'bg-orange-50', oils: 'bg-yellow-50',
  produce: 'bg-green-50', fruits: 'bg-red-50', roots: 'bg-amber-50',
  proteins: 'bg-rose-50', dairy: 'bg-blue-50', drinks: 'bg-cyan-50',
  spices: 'bg-red-50', prepared: 'bg-purple-50', household: 'bg-slate-50',
  hygiene: 'bg-pink-50', tobacco: 'bg-gray-50', hardware: 'bg-zinc-50',
  alcohol: 'bg-amber-50', raw_materials: 'bg-teal-50', fragrances: 'bg-fuchsia-50',
};

// Build a map from product name_creole → category for matching inventory items to catalog categories
const catalogCategoryMap = new Map<string, string>();
const catalogEmojiMap = new Map<string, string>();
for (const p of STARTER_PRODUCTS) {
  catalogCategoryMap.set(p.nameHT.toLowerCase(), p.category);
  catalogEmojiMap.set(p.nameHT.toLowerCase(), p.emoji);
}

function getProductCategory(p: ProductRecord): string | null {
  return catalogCategoryMap.get(p.name_creole?.toLowerCase() ?? '') ?? catalogCategoryMap.get(p.name.toLowerCase()) ?? null;
}

function getProductEmoji(p: ProductRecord): string | null {
  return catalogEmojiMap.get(p.name_creole?.toLowerCase() ?? '') ?? catalogEmojiMap.get(p.name.toLowerCase()) ?? null;
}

// Category-based background colors for product card icons
const CATEGORY_COLORS: Record<string, { bg: string; ring: string }> = {
  grains:    { bg: 'bg-amber-50',   ring: 'ring-amber-200' },
  legumes:   { bg: 'bg-orange-50',  ring: 'ring-orange-200' },
  oils:      { bg: 'bg-yellow-50',  ring: 'ring-yellow-200' },
  produce:   { bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  fruits:    { bg: 'bg-pink-50',    ring: 'ring-pink-200' },
  roots:     { bg: 'bg-orange-50',  ring: 'ring-orange-200' },
  proteins:  { bg: 'bg-red-50',     ring: 'ring-red-200' },
  dairy:     { bg: 'bg-sky-50',     ring: 'ring-sky-200' },
  drinks:    { bg: 'bg-cyan-50',    ring: 'ring-cyan-200' },
  spices:    { bg: 'bg-rose-50',    ring: 'ring-rose-200' },
  prepared:  { bg: 'bg-violet-50',  ring: 'ring-violet-200' },
  household: { bg: 'bg-slate-50',   ring: 'ring-slate-200' },
  hygiene:   { bg: 'bg-indigo-50',  ring: 'ring-indigo-200' },
  tobacco:   { bg: 'bg-stone-50',   ring: 'ring-stone-200' },
  hardware:  { bg: 'bg-zinc-50',    ring: 'ring-zinc-200' },
  alcohol:       { bg: 'bg-amber-50',   ring: 'ring-amber-200' },
  raw_materials: { bg: 'bg-teal-50',    ring: 'ring-teal-200' },
  fragrances:    { bg: 'bg-fuchsia-50', ring: 'ring-fuchsia-200' },
};
const DEFAULT_CAT_COLOR = { bg: 'bg-gray-50', ring: 'ring-gray-200' };

function getCatLabel(cat: typeof CATEGORIES[number], locale: Locale) {
  if (locale === 'fr') return cat.labelFR;
  if (locale === 'en') return cat.labelEN;
  return cat.labelHT;
}

function suggestThreshold(unit: string, stockQuantity: number): number {
  const percentBased = Math.max(1, Math.round(stockQuantity * 0.15));
  const unitMinimums: Record<string, number> = {
    mamit: 3, sak: 2, 'douzèn': 2, liv: 5, 'boutèy': 5, 'pyès': 10,
    'pakèt': 5, bwat: 3, galon: 2, rejim: 2, 'vè': 10, sache: 20,
    woulo: 5, tib: 3, 'tèt': 5, 'pè': 5, 'mèt': 10, 'pòsyon': 10,
    'bòl': 10, 'gwo boutèy': 3, 'ti sak': 10,
  };
  const unitMin = unitMinimums[unit] || 5;
  return stockQuantity > 0 ? Math.max(unitMin, Math.min(percentBased, stockQuantity)) : unitMin;
}

export default function InventoryPage() {
  const { t, locale } = useI18n();
  const { products, archivedProducts, loading, refresh } = useProducts();
  const enqueue = useSyncStore((s) => s.enqueue);
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'active'>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [_toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const [showArchived, setShowArchived] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [archiveDialog, setArchiveDialog] = useState<{ id: string; name: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [thresholdEdit, setThresholdEdit] = useState<{ id: string; name: string; stock: number; unit: string; value: number } | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Locations for stock transfer
  const locations = useLocationStore((s) => s.locations);
  const [transferProduct, setTransferProduct] = useState<ProductRecord | null>(null);

  // Global default threshold settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const thresholdSettingsKey = `tlsm_default_threshold_mode_${vendorId}`;
  const [defaultThresholdMode, setDefaultThresholdMode] = useState<'auto' | 'fixed' | 'disabled'>(() => {
    try { const s = localStorage.getItem(thresholdSettingsKey); if (s) return JSON.parse(s).mode; } catch {}
    return 'auto';
  });
  const [defaultThresholdValue, setDefaultThresholdValue] = useState<number>(() => {
    try { const s = localStorage.getItem(thresholdSettingsKey); if (s) return JSON.parse(s).value; } catch {}
    return 5;
  });
  const saveThresholdSettings = () => {
    localStorage.setItem(thresholdSettingsKey, JSON.stringify({ mode: defaultThresholdMode, value: defaultThresholdValue }));
    setSettingsOpen(false);
    showToast(t('settings.saved'), 'success');
  };

  // Escape key closes topmost modal (highest z-index first)
  useEffect(() => {
    if (!deleteDialog && !archiveDialog && !thresholdEdit && !settingsOpen && !contextMenu) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteDialog) setDeleteDialog(null);
        else if (archiveDialog) setArchiveDialog(null);
        else if (thresholdEdit) setThresholdEdit(null);
        else if (settingsOpen) setSettingsOpen(false);
        else if (contextMenu) setContextMenu(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteDialog, archiveDialog, thresholdEdit, settingsOpen, contextMenu]);

  const filtered = useMemo(() => {
    let list = products;
    if (filter === 'low_stock') list = list.filter((p) => p.low_stock_threshold > 0 && Number(p.stock_quantity) <= p.low_stock_threshold);
    else if (filter === 'active') list = list.filter((p) => p.is_active);
    if (activeCategory) list = list.filter((p) => getProductCategory(p) === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.name_creole?.toLowerCase().includes(q));
    }
    return list;
  }, [products, search, filter, activeCategory]);

  const activeCategoryLabel = useMemo(() => {
    if (!activeCategory) return null;
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    return cat ? getCatLabel(cat, locale) : null;
  }, [activeCategory, locale]);

  const categoryCountText = activeCategory && activeCategoryLabel
    ? t('category.products_in').replace('{count}', String(filtered.length)).replace('{category}', activeCategoryLabel)
    : null;

  // Product counts per category for filter chips
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('all', products.length);
    counts.set('low_stock', products.filter((p) => p.low_stock_threshold > 0 && Number(p.stock_quantity) <= p.low_stock_threshold).length);
    counts.set('active', products.filter((p) => p.is_active).length);
    for (const p of products) {
      const cat = getProductCategory(p);
      if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  // Archive: show confirmation dialog first
  const requestArchive = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setArchiveDialog({ id, name: product.name });
  };

  // Actually perform archive (called from dialog) with undo support
  const confirmArchive = async () => {
    if (!archiveDialog) return;
    const { id } = archiveDialog;
    setArchiveDialog(null);
    try {
      const product = products.find((p) => p.id === id);
      if (!product) return;
      const archived = { ...product, is_active: false };
      await putInStore('products', archived);
      refresh();
      // Show toast with undo
      setUndoId(id);
      showToast(t('archive.done'), 'success');
      // After 5s, sync to server and clear undo
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(async () => {
        setUndoId(null);
        await enqueue({ endpoint: `/products/${id}`, method: 'PATCH', body: { is_active: false } });
        if (navigator.onLine) api.patch(`/products/${id}`, { is_active: false }).catch(() => {});
      }, 5000);
    } catch (err) { console.error('[Talisman] Archive failed:', err); }
  };

  // Undo archive
  const handleUndo = async () => {
    if (!undoId) return;
    if (undoTimer.current) { clearTimeout(undoTimer.current); undoTimer.current = null; }
    const product = archivedProducts.find((p) => p.id === undoId);
    if (product) {
      await putInStore('products', { ...product, is_active: true });
      refresh();
    }
    setUndoId(null);
    setToast('');
  };

  // Duplicate product
  const handleDuplicate = async (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const copy: ProductRecord = {
      ...product,
      id: crypto.randomUUID(),
      name: `${product.name} (2)`,
      stock_quantity: 0,
    };
    await putInStore('products', copy);
    await enqueue({ endpoint: '/products', method: 'POST', body: {
      name: copy.name, name_creole: copy.name_creole || null, unit: copy.unit,
      current_price: String(copy.current_price), cost_price: copy.cost_price ? String(copy.cost_price) : null,
      stock_quantity: '0', low_stock_threshold: String(copy.low_stock_threshold),
    }});
    showToast(t('message.product_added'), 'success');
    refresh();
  };

  // Restore: set is_active = true
  const handleRestore = async (id: string) => {
    try {
      const product = archivedProducts.find((p) => p.id === id);
      if (!product) return;
      const restored = { ...product, is_active: true };
      await putInStore('products', restored);
      await enqueue({ endpoint: `/products/${id}`, method: 'PATCH', body: { is_active: true } });
      if (navigator.onLine) api.patch(`/products/${id}`, { is_active: true }).catch(() => {});
      showToast(t('archive.restored'), 'success');
      refresh();
    } catch (err) { console.error('[Talisman] Restore failed:', err); }
  };

  // Permanent delete: check transactions first, then show dialog
  const requestPermanentDelete = async (id: string) => {
    const txns = vendorId ? await getVendorRecords('transactions', vendorId) : [];
    const hasTransactions = txns.some((txn: TransactionRecord) => txn.product_id === id);
    if (hasTransactions) {
      showToast(t('archive.has_transactions'), 'warning');
      return;
    }
    const product = [...products, ...archivedProducts].find((p) => p.id === id);
    if (!product) return;
    setDeleteDialog({ id, name: product.name });
  };

  const confirmPermanentDelete = async () => {
    if (!deleteDialog) return;
    const { id } = deleteDialog;
    setDeleteDialog(null);
    try {
      await deleteFromStore('products', id);
      if (navigator.onLine) api.delete(`/products/${id}`).catch(() => {});
      else await enqueue({ endpoint: `/products/${id}`, method: 'DELETE', body: null });
      showToast(t('archive.permanent_done'), 'success');
      refresh();
    } catch (err) { console.error('[Talisman] Permanent delete failed:', err); }
  };

  // Bulk archive
  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      const product = products.find((p) => p.id === id);
      if (product) {
        await putInStore('products', { ...product, is_active: false });
        await enqueue({ endpoint: `/products/${id}`, method: 'PATCH', body: { is_active: false } });
        if (navigator.onLine) api.patch(`/products/${id}`, { is_active: false }).catch(() => {});
      }
    }
    const count = selectedIds.size;
    setSelectMode(false);
    setSelectedIds(new Set());
    showToast(t('archive.bulk_done').replace('{count}', String(count)), 'success');
    refresh();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Quick threshold edit
  const openThresholdEdit = (id: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setThresholdEdit({ id, name: product.name, stock: product.stock_quantity, unit: product.unit, value: product.low_stock_threshold });
  };

  const saveThresholdEdit = async () => {
    if (!thresholdEdit) return;
    const { id, value } = thresholdEdit;
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const updated = { ...product, low_stock_threshold: value };
    await putInStore('products', updated);
    await enqueue({ endpoint: `/products/${id}`, method: 'PATCH', body: { low_stock_threshold: String(value) } });
    if (navigator.onLine) api.patch(`/products/${id}`, { low_stock_threshold: String(value) }).catch(() => {});
    setThresholdEdit(null);
    showToast(t('message.product_updated'), 'success');
    refresh();
  };

  // Context menu handlers
  const openContextMenu = (id: string, x: number, y: number) => {
    // Clamp to viewport
    const clampedX = Math.min(x, window.innerWidth - 200);
    const clampedY = Math.min(y, window.innerHeight - 180);
    setContextMenu({ id, x: clampedX, y: clampedY });
  };

  // Close context menu on any outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => { document.removeEventListener('click', close); document.removeEventListener('scroll', close, true); };
  }, [contextMenu]);

  function showToast(msg: string, variant: ToastVariant = 'success') {
    setToast(msg); setToastVariant(variant);
    setTimeout(() => setToast(''), 5000);
  }

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Toast with optional undo */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] bg-[#1F2937] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in max-w-sm">
          <span className="text-sm flex-1">{toast}</span>
          {undoId && (
            <button type="button" onClick={handleUndo}
              className="text-sm font-bold text-[#F4A261] hover:text-[#FFD166] transition-colors flex-shrink-0">
              {t('archive.undo')}
            </button>
          )}
        </div>
      )}

      {/* Bulk select bar */}
      {selectMode && (
        <div className="sticky top-0 z-50 bg-white border-b border-gray-100 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              className="text-sm font-medium text-[var(--c-text2)]">{t('action.cancel')}</button>
            <span className="text-sm font-bold text-[var(--c-text)]">
              {t('archive.selected_count').replace('{count}', String(selectedIds.size))}
            </span>
          </div>
          <button type="button" onClick={handleBulkArchive} disabled={selectedIds.size === 0}
            className="h-9 px-4 rounded-xl bg-[#F4A261] text-white text-sm font-bold disabled:opacity-40 flex items-center gap-1.5">
            <RiArchiveLine className="h-4 w-4" />
            {t('archive.archive_all')}
          </button>
        </div>
      )}

      {/* Search + Add button row */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('action.search')}
            className="w-full h-12 pl-11 pr-4 rounded-full bg-white shadow-sm text-sm font-body focus:ring-2 focus:ring-[#0D9488] focus:border-transparent transition-shadow"
          />
        </div>
        {!selectMode && (
          <button
            type="button"
            onClick={() => { setEditId(null); setSheetOpen(true); }}
            className="hidden md:flex h-12 px-5 rounded-full items-center gap-2 text-white font-heading font-bold text-sm shadow-sm flex-shrink-0"
            style={{ background: 'var(--gradient-teal)' }}
          >
            <RiAddLine className="h-5 w-5" />
            {t('action.add_product')}
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(['all', 'low_stock', 'active'] as const).map((f) => {
          const count = categoryCounts.get(f) ?? 0;
          return (
            <button key={f} type="button" onClick={() => { setFilter(f); setShowArchived(false); }}
              className={`h-9 px-4 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                filter === f && !showArchived
                  ? 'bg-[var(--c-primary)] text-white shadow-sm'
                  : `bg-white text-[var(--c-text2)] border border-gray-200 ${products.length === 0 ? 'opacity-60' : ''}`
              }`}>
              {t(`filter.${f}`)}
              <span className={`ml-1.5 text-[11px] ${filter === f && !showArchived ? 'text-white/70' : 'text-[var(--c-muted)]'}`}>
                ({count})
              </span>
            </button>
          );
        })}
        {archivedProducts.length > 0 && (
          <button type="button" onClick={() => setShowArchived(!showArchived)}
            className={`h-9 px-4 rounded-full text-sm font-medium transition-colors flex-shrink-0 flex items-center gap-1.5 ${
              showArchived
                ? 'bg-[#F4A261] text-white shadow-sm'
                : 'bg-white text-[var(--c-text2)] border border-gray-200'
            }`}>
            📦 {t('archive.show')}
            <span className={`text-[11px] ${showArchived ? 'text-white/70' : 'text-[var(--c-muted)]'}`}>
              ({archivedProducts.length})
            </span>
          </button>
        )}
        {products.length > 1 && !selectMode && (
          <button type="button" onClick={() => setSelectMode(true)}
            className="h-9 px-4 rounded-full text-sm font-medium text-[var(--c-text2)] border border-gray-200 bg-white flex-shrink-0">
            {t('archive.select')}
          </button>
        )}
      </div>

      {/* Category grid */}
      {products.length > 0 && (
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 md:flex-wrap md:overflow-visible lg:grid lg:grid-cols-5 lg:gap-2">
            {/* All button */}
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`flex flex-col items-center justify-center gap-1 min-w-[80px] h-[80px] rounded-2xl shadow-sm flex-shrink-0 transition-all ${
                activeCategory === null ? 'bg-[#F0FDF4] border-2 border-[var(--c-primary)]' : 'bg-white border-2 border-transparent'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${activeCategory === null ? 'bg-[var(--c-primary)] text-white' : 'bg-gray-100 text-[var(--c-text2)]'}`}>
                <RiLayoutGridLine className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-bold text-[var(--c-text)] text-center leading-tight">
                {t('filter.all')} <span className="text-[var(--c-muted)] font-normal">({products.length})</span>
              </span>
            </button>
            {CATEGORIES.map((cat) => {
              const catCount = categoryCounts.get(cat.id) ?? 0;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`flex flex-col items-center justify-center gap-1 min-w-[80px] h-[80px] rounded-2xl shadow-sm flex-shrink-0 transition-all ${
                    activeCategory === cat.id ? 'bg-[#F0FDF4] border-2 border-[var(--c-primary)]' : `bg-white border-2 border-transparent ${catCount === 0 ? 'opacity-40' : ''}`
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${CATEGORY_BG[cat.id] ?? 'bg-gray-50'}`}>
                    {cat.emoji}
                  </div>
                  <span className="text-[11px] font-bold text-[var(--c-text)] text-center leading-tight line-clamp-2 max-w-[76px]">
                    {getCatLabel(cat, locale)} <span className="text-[var(--c-muted)] font-normal">({catCount})</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="md:hidden absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[var(--c-bg)] to-transparent pointer-events-none rounded-r-2xl" />
          {categoryCountText && (
            <p className="text-xs text-[var(--c-muted)] mt-1">{categoryCountText}</p>
          )}
        </div>
      )}

      {/* Catalog & Import & Settings links */}
      <div className="flex gap-2">
        <Link to="/catalog"
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-gray-200 text-sm font-medium text-[var(--c-primary)]">
          <RiBookOpenLine className="h-4 w-4" /> {t('catalog.browse_catalog')}
        </Link>
        <Link to="/import"
          className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-white border border-gray-200 text-sm font-medium text-[var(--c-primary)]">
          <RiFileListLine className="h-4 w-4" /> {t('import.btn')}
        </Link>
        <button type="button" onClick={() => setSettingsOpen(true)}
          className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-[var(--c-primary)] flex-shrink-0">
          <RiSettings3Line className="h-5 w-5" />
        </button>
      </div>

      {/* Product list — active or archived */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : showArchived ? (
        /* ── Archived products view ── */
        archivedProducts.length === 0 ? (
          <div className="card p-10 text-center space-y-3">
            <p className="text-4xl">📦</p>
            <p className="text-[var(--c-text2)]">{t('archive.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {archivedProducts.map((p) => (
              <div key={p.id} className="card p-4 opacity-60 relative">
                {/* Archived badge */}
                <span className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {t('archive.badge')}
                </span>
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-3 mt-4 grayscale">
                  {getProductEmoji(p) ?? '📦'}
                </div>
                <p className="font-heading font-semibold text-[15px] text-[var(--c-text)] line-clamp-2 leading-tight">{p.name}</p>
                <p className="text-[13px] text-[var(--c-muted)] mt-1">{Number(p.current_price).toLocaleString()} {t('label.currency')}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => handleRestore(p.id)}
                    className="flex-1 h-9 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-100 transition-colors"
                  >
                    <RiInboxUnarchiveLine className="h-3.5 w-3.5" />
                    {t('archive.restore')}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestPermanentDelete(p.id)}
                    className="h-9 px-2 rounded-lg text-[#E76F51] text-xs font-bold flex items-center justify-center gap-1 hover:bg-red-50 transition-colors"
                  >
                    <RiDeleteBin6Line className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
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
      ) : !activeCategory && !search && !selectMode && filtered.length > 0 ? (
        /* Grouped by category in "Tout" view */
        <div className="space-y-6">
          {(() => {
            // Group products by category
            const groups = new Map<string, ProductRecord[]>();
            const uncategorized: ProductRecord[] = [];
            for (const p of filtered) {
              const cat = getProductCategory(p);
              if (cat) {
                if (!groups.has(cat)) groups.set(cat, []);
                groups.get(cat)!.push(p);
              } else {
                uncategorized.push(p);
              }
            }
            // Order by CATEGORIES array
            const orderedGroups = CATEGORIES
              .filter((c) => groups.has(c.id))
              .map((c) => ({ cat: c, products: groups.get(c.id)! }));
            if (uncategorized.length > 0) orderedGroups.push({ cat: { id: 'other', labelHT: 'Lòt', labelFR: 'Autres', labelEN: 'Other', emoji: '📦' }, products: uncategorized });
            return orderedGroups.map(({ cat, products: catProducts }) => (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{cat.emoji}</span>
                  <h3 className="font-heading font-bold text-[15px] text-[var(--c-text)]">{getCatLabel(cat, locale)}</h3>
                  <span className="text-[12px] text-[var(--c-muted)]">({catProducts.length})</span>
                  <div className="flex-1 h-px bg-[var(--c-border)] ml-2" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {catProducts.map((p) => (
                    <ProductGridCard key={p.id} product={p} t={t}
                      onTap={() => { setEditId(p.id); setSheetOpen(true); }}
                      onContextMenu={(x, y) => openContextMenu(p.id, x, y)}
                      longPressTimer={longPressTimer} />
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      ) : (
        /* Flat grid for filtered/search/select views */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((p) => (
            selectMode ? (
              <div key={p.id}
                className={`card p-4 lg:p-5 cursor-pointer relative transition-all ${selectedIds.has(p.id) ? 'ring-2 ring-[#F4A261] shadow-md' : ''}`}
                onClick={() => toggleSelect(p.id)}
              >
                <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedIds.has(p.id) ? 'bg-[#F4A261] border-[#F4A261]' : 'border-gray-300 bg-white'
                }`}>
                  {selectedIds.has(p.id) && <span className="text-white text-xs font-bold">✓</span>}
                </div>
                <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-2xl mb-3 mt-2">
                  {getProductEmoji(p) ?? p.name.charAt(0)}
                </div>
                <p className="font-heading font-semibold text-[15px] text-[var(--c-text)] line-clamp-2 leading-tight">{p.name}</p>
                <p className="font-heading font-bold text-base text-[var(--c-primary)] mt-1">
                  {Number(p.current_price).toLocaleString()} {t('label.currency')}
                </p>
              </div>
            ) : (
              <ProductGridCard key={p.id} product={p} t={t}
                onTap={() => { setEditId(p.id); setSheetOpen(true); }}
                onContextMenu={(x, y) => openContextMenu(p.id, x, y)}
                longPressTimer={longPressTimer} />
            )
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[60] bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 min-w-[200px] animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { setEditId(contextMenu.id); setSheetOpen(true); setContextMenu(null); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--c-text)] hover:bg-gray-50 flex items-center gap-3"
          >
            <RiPencilLine className="h-4 w-4 text-[var(--c-text2)]" />
            {t('action.edit')}
          </button>
          <button
            type="button"
            onClick={() => { handleDuplicate(contextMenu.id); setContextMenu(null); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--c-text)] hover:bg-gray-50 flex items-center gap-3"
          >
            <RiFileCopyLine className="h-4 w-4 text-[var(--c-text2)]" />
            {t('archive.duplicate')}
          </button>
          <button
            type="button"
            onClick={() => { openThresholdEdit(contextMenu.id); setContextMenu(null); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--c-text)] hover:bg-gray-50 flex items-center gap-3"
          >
            <RiAlertLine className="h-4 w-4 text-amber-500" />
            {t('threshold.change')}
          </button>
          {locations.length >= 2 && (() => {
            const prod = products.find((p) => p.id === contextMenu.id);
            return prod ? (
              <button
                type="button"
                onClick={() => { setTransferProduct(prod); setContextMenu(null); }}
                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--c-text)] hover:bg-gray-50 flex items-center gap-3"
              >
                <RiArrowLeftRightLine className="h-4 w-4 text-[var(--c-primary)]" />
                {t('locations.transfer')}
              </button>
            ) : null;
          })()}
          <div className="mx-3 my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={() => { requestArchive(contextMenu.id); setContextMenu(null); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[#F4A261] hover:bg-orange-50 flex items-center gap-3"
          >
            <RiArchiveLine className="h-4 w-4" />
            {t('archive.action')}
          </button>
          <button
            type="button"
            onClick={() => { requestPermanentDelete(contextMenu.id); setContextMenu(null); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-[#E76F51] hover:bg-red-50 flex items-center gap-3"
          >
            <RiDeleteBin6Line className="h-4 w-4" />
            {t('archive.permanent_delete')}
          </button>
        </div>
      )}

      {/* Stock Transfer dialog */}
      {transferProduct && (
        <StockTransfer
          product={transferProduct}
          locations={locations}
          vendorId={vendorId}
          onClose={() => setTransferProduct(null)}
          onComplete={(msg) => { setTransferProduct(null); showToast(msg); refresh(); }}
        />
      )}

      {/* Archive confirmation dialog */}
      {archiveDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setArchiveDialog(null)} />
          <div className="relative bg-white rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-3">📦</p>
              <h3 className="font-heading text-xl font-bold text-[var(--c-text)]">{t('archive.confirm_title')}</h3>
            </div>
            <p className="text-sm text-[var(--c-text2)] text-center leading-relaxed">
              {t('archive.confirm_body').replace('{name}', archiveDialog.name)}
            </p>
            <p className="text-xs text-[var(--c-muted)] text-center">
              {t('archive.confirm_note')}
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setArchiveDialog(null)}
                className="flex-1 h-12 rounded-xl bg-gray-100 text-[var(--c-text2)] font-heading font-bold text-sm"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                className="flex-1 h-12 rounded-xl bg-[#F4A261] text-white font-heading font-bold text-sm shadow-md gap-2 flex items-center justify-center"
              >
                {t('archive.action')} ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threshold quick-edit dialog */}
      {thresholdEdit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setThresholdEdit(null)} />
          <div className="relative bg-white rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-4">
            <div className="flex items-center gap-2">
              <RiAlertLine className="h-5 w-5 text-amber-500" />
              <h3 className="font-heading text-lg font-bold text-[var(--c-text)]">{t('threshold.title')}</h3>
            </div>
            <div>
              <p className="font-heading font-semibold text-[15px] text-[var(--c-text)]">{thresholdEdit.name}</p>
              <p className="text-[13px] text-[var(--c-muted)]">
                {t('threshold.current_stock').replace('{stock}', String(thresholdEdit.stock)).replace('{unit}', thresholdEdit.unit)}
              </p>
            </div>
            <div>
              <p className="text-[13px] text-amber-700 mb-2">{t('threshold.when')}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
                  <button type="button"
                    onClick={() => setThresholdEdit({ ...thresholdEdit, value: Math.max(0, thresholdEdit.value - 1) })}
                    className="w-10 h-10 flex items-center justify-center text-amber-600 active:bg-amber-100">
                    <RiSubtractLine className="h-4 w-4" />
                  </button>
                  <input type="number" value={thresholdEdit.value}
                    onChange={(e) => setThresholdEdit({ ...thresholdEdit, value: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-16 h-10 text-center text-[18px] font-bold text-amber-800 bg-white outline-none border-x border-amber-200" min={0} />
                  <button type="button"
                    onClick={() => setThresholdEdit({ ...thresholdEdit, value: thresholdEdit.value + 1 })}
                    className="w-10 h-10 flex items-center justify-center text-amber-600 active:bg-amber-100">
                    <RiAddLine className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-[13px] text-amber-700 font-medium">{thresholdEdit.unit}</span>
              </div>
              {thresholdEdit.value === 0 && (
                <p className="text-[12px] text-[var(--c-muted)] mt-2 italic">{t('threshold.disabled')}</p>
              )}
            </div>
            <button type="button" onClick={saveThresholdEdit}
              className="btn w-full h-12 rounded-xl bg-amber-500 text-white font-heading font-bold text-sm shadow-md">
              {t('action.save')} ✓
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteDialog(null)} />
          <div className="relative bg-white rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-4">
            <div className="text-center">
              <p className="text-4xl mb-3">🗑️</p>
              <h3 className="font-heading text-xl font-bold text-[var(--c-text)]">{t('archive.delete_confirm_title')}</h3>
            </div>
            <p className="text-sm text-[var(--c-text2)] text-center leading-relaxed">
              {t('archive.delete_confirm_body').replace('{name}', deleteDialog.name)}
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="flex-1 h-12 rounded-xl bg-gray-100 text-[var(--c-text2)] font-heading font-bold text-sm"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmPermanentDelete}
                className="flex-1 h-12 rounded-xl bg-[#E76F51] text-white font-heading font-bold text-sm shadow-md gap-2 flex items-center justify-center"
              >
                {t('action.delete')} 🗑️
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />
          <div className="relative bg-white rounded-3xl p-6 mx-4 w-full max-w-sm shadow-2xl animate-fade-up space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RiSettings3Line className="h-5 w-5 text-[var(--c-primary)]" />
                <h3 className="font-heading text-lg font-bold text-[var(--c-text)]">{t('settings.title')}</h3>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100" aria-label={t('aria.close')}>
                <RiCloseLine className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-[var(--c-text)]">{t('settings.threshold_default')}</p>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${defaultThresholdMode === 'auto' ? 'border-[var(--c-primary)] bg-[#F0FDF4]' : 'border-gray-200'}`}>
                <input type="radio" name="threshold_mode" value="auto" checked={defaultThresholdMode === 'auto'}
                  onChange={() => setDefaultThresholdMode('auto')} className="accent-[var(--c-primary)]" />
                <span className="text-sm text-[var(--c-text)]">{t('settings.threshold_auto')}</span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${defaultThresholdMode === 'fixed' ? 'border-[var(--c-primary)] bg-[#F0FDF4]' : 'border-gray-200'}`}>
                <input type="radio" name="threshold_mode" value="fixed" checked={defaultThresholdMode === 'fixed'}
                  onChange={() => setDefaultThresholdMode('fixed')} className="accent-[var(--c-primary)]" />
                <span className="text-sm text-[var(--c-text)]">{t('settings.threshold_fixed')}</span>
                {defaultThresholdMode === 'fixed' && (
                  <input type="number" inputMode="numeric" value={defaultThresholdValue} min={1}
                    onChange={(e) => setDefaultThresholdValue(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16 h-8 text-center text-sm font-bold rounded-lg border border-gray-300 ml-auto" />
                )}
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${defaultThresholdMode === 'disabled' ? 'border-[var(--c-primary)] bg-[#F0FDF4]' : 'border-gray-200'}`}>
                <input type="radio" name="threshold_mode" value="disabled" checked={defaultThresholdMode === 'disabled'}
                  onChange={() => setDefaultThresholdMode('disabled')} className="accent-[var(--c-primary)]" />
                <span className="text-sm text-[var(--c-text)]">{t('settings.threshold_none')}</span>
              </label>
            </div>

            <button type="button" onClick={saveThresholdSettings}
              className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-sm shadow-md">
              {t('action.save')}
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => { setEditId(null); setSheetOpen(true); }}
        className="md:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform z-40"
        style={{ background: 'var(--gradient-teal)' }}
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
          vendorId={vendorId}
        />
      )}
    </div>
  );
}

/* ── Product card ── */

/* ── Grid Card for 2-column layout ── */
function ProductGridCard({ product: p, t, onTap, onContextMenu, longPressTimer }: {
  product: ProductRecord; t: (k: string) => string; onTap: () => void;
  onContextMenu: (x: number, y: number) => void;
  longPressTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}) {
  const maxRef = p.low_stock_threshold > 0 ? Math.max(p.low_stock_threshold * 3, p.stock_quantity, 1) : Math.max(p.stock_quantity, 1);
  const pct = Math.min(100, (p.stock_quantity / maxRef) * 100);
  const barColor = p.low_stock_threshold === 0 ? 'bg-emerald-500'
    : p.stock_quantity === 0 ? 'bg-[#E76F51]'
    : p.stock_quantity <= p.low_stock_threshold ? 'bg-[#F4A261]'
    : 'bg-emerald-500';
  const emoji = getProductEmoji(p);
  const didLongPress = useRef(false);

  return (
    <div
      className="card p-4 lg:p-5 active:scale-[0.97] transition-transform cursor-pointer relative group"
      onClick={() => { if (!didLongPress.current) onTap(); didLongPress.current = false; }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
      onTouchStart={(e) => {
        didLongPress.current = false;
        const touch = e.touches[0];
        longPressTimer.current = setTimeout(() => {
          didLongPress.current = true;
          onContextMenu(touch.clientX, touch.clientY);
        }, 500);
      }}
      onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
      onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
      role="button" tabIndex={0}
    >
      {/* ⋮ menu button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); onContextMenu(rect.right - 200, rect.bottom + 4); }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[var(--c-bg)]/80 flex items-center justify-center text-[var(--c-text2)] hover:bg-[var(--c-bg)] active:scale-95 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 md:opacity-100"
        aria-label={t('archive.product_menu')}
      >
        <RiMore2Fill className="h-4 w-4" />
      </button>
      {(() => {
        // Priority: photo > emoji > initial
        if (p.photo_url) {
          return (
            <img src={p.photo_url} alt={p.name}
              className="w-14 h-14 rounded-2xl object-cover mb-3 mx-auto ring-1 ring-gray-200" />
          );
        }
        const cat = getProductCategory(p);
        const catColor = cat ? (CATEGORY_COLORS[cat] ?? DEFAULT_CAT_COLOR) : DEFAULT_CAT_COLOR;
        return emoji ? (
          <div className={`w-14 h-14 rounded-2xl ${catColor.bg} ring-1 ${catColor.ring} flex items-center justify-center text-[32px] mb-3 mx-auto`}>
            {emoji}
          </div>
        ) : (
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-xl mb-3 mx-auto"
            style={{ background: 'var(--gradient-teal)' }}>
            {p.name.charAt(0).toUpperCase()}
          </div>
        );
      })()}
      <p className="font-heading font-bold text-[15px] text-[var(--c-text)] line-clamp-2 leading-tight text-center">{p.name}</p>
      <div className="mt-1.5 text-center">
        <p className="font-heading font-extrabold text-xl text-[var(--c-primary)] leading-tight">
          {Number(p.current_price).toLocaleString()} <span className="text-base font-bold">G</span>
        </p>
        <p className="text-[12px] font-medium text-[var(--c-text2)] mt-0.5">{p.unit}</p>
      </div>
      {/* Stock bar */}
      <div className="mt-2">
        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-[var(--c-muted)] mt-1">{p.stock_quantity} {p.unit}</p>
        <p className="text-[10px] text-[var(--c-muted)]">
          {p.low_stock_threshold > 0
            ? t('threshold.alert_label').replace('{threshold}', String(p.low_stock_threshold)).replace('{unit}', p.unit)
            : t('threshold.alert_off')
          }
        </p>
      </div>
    </div>
  );
}

/* ── Product sheet ── */

function ProductSheet({ editId, products, t, onClose, onSaved, enqueue, vendorId }: {
  editId: string | null; products: ProductRecord[];
  t: (k: string) => string; onClose: () => void;
  onSaved: (msg: string) => void;
  enqueue: (item: { endpoint: string; method: 'POST' | 'PATCH' | 'DELETE'; body: unknown }) => Promise<void>;
  vendorId: string;
}) {
  const existing = editId ? products.find((p) => p.id === editId) : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [nameCreole, setNameCreole] = useState(existing?.name_creole ?? '');
  const [unit, setUnit] = useState(existing?.unit ?? 'mamit');
  const [price, setPrice] = useState(existing?.current_price?.toString() ?? '');
  const [costPrice, setCostPrice] = useState(existing?.cost_price?.toString() ?? '');
  const [stock, setStock] = useState(existing?.stock_quantity?.toString() ?? '');
  const [threshold, setThreshold] = useState(existing?.low_stock_threshold?.toString() ?? String(suggestThreshold('mamit', 0)));
  const [thresholdManuallyEdited, setThresholdManuallyEdited] = useState(!!editId);
  const [photoUrl, setPhotoUrl] = useState<string | null>(existing?.photo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (existing) {
      setName(existing.name); setNameCreole(existing.name_creole ?? '');
      setUnit(existing.unit); setPrice(existing.current_price.toString());
      setCostPrice(existing.cost_price?.toString() ?? '');
      setStock(existing.stock_quantity.toString()); setThreshold(existing.low_stock_threshold.toString());
    }
  }, [existing]);

  // Auto-suggest threshold when stock or unit changes (new products only)
  // Respects global default threshold setting from localStorage
  useEffect(() => {
    if (!editId && !thresholdManuallyEdited) {
      try {
        const settingsRaw = localStorage.getItem(`tlsm_default_threshold_mode_${vendorId}`);
        if (settingsRaw) {
          const settings = JSON.parse(settingsRaw) as { mode: string; value: number };
          if (settings.mode === 'disabled') { setThreshold('0'); return; }
          if (settings.mode === 'fixed') { setThreshold(String(settings.value)); return; }
        }
      } catch {}
      // mode === 'auto' or no setting: use unit-based suggestion
      if (stock) {
        const suggested = suggestThreshold(unit, Number(stock) || 0);
        setThreshold(String(suggested));
      }
    }
  }, [stock, unit, editId, thresholdManuallyEdited, vendorId]);

  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Validate all fields
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('validation.name_required');
    if (!price || price.trim() === '') errs.price = t('validation.price_required');
    else if (Number(price) < 0) errs.price = t('validation.price_positive');
    if (stock && Number(stock) < 0) errs.stock = t('validation.stock_positive');
    if (costPrice && Number(costPrice) < 0) errs.costPrice = t('validation.cost_positive');
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

    // Duplicate check (only for new products, not edits)
    if (!editId && !duplicateConfirmed) {
      const normalizedName = name.trim().toLowerCase();
      const isDuplicate = products.some((p) =>
        p.name.trim().toLowerCase() === normalizedName ||
        (p.name_creole && p.name_creole.trim().toLowerCase() === normalizedName)
      );
      if (isDuplicate) {
        setDuplicateWarning(true);
        return;
      }
    }

    setSaving(true);
    setError('');
    setDuplicateWarning(false);
    setDuplicateConfirmed(false);
    const apiPayload = { name, name_creole: nameCreole || null, unit, current_price: price, cost_price: costPrice || null, stock_quantity: stock || '0', low_stock_threshold: threshold || '0' };
    try {
      if (editId) {
        // Offline-first: write to IndexedDB immediately
        const localProduct: ProductRecord = { ...existing!, ...apiPayload, name_creole: nameCreole || undefined, current_price: Number(price), cost_price: costPrice !== '' ? Number(costPrice) : undefined, stock_quantity: Number(stock || '0'), low_stock_threshold: Number(threshold) || 0, photo_url: photoUrl };
        await putInStore('products', localProduct);
        onSaved(t('message.product_updated'));
        // Background sync
        await enqueue({ endpoint: `/products/${editId}`, method: 'PATCH', body: apiPayload });
        if (navigator.onLine) {
          try {
            const { data } = await api.patch<ProductRecord>(`/products/${editId}`, apiPayload);
            data.current_price = Number(data.current_price);
            data.stock_quantity = Number(data.stock_quantity);
            data.low_stock_threshold = Number(data.low_stock_threshold);
            if (data.cost_price != null) data.cost_price = Number(data.cost_price);
            await putInStore('products', data);
          } catch (err) { console.warn('[Talisman] Background sync failed, queued for retry:', err); }
        }
      } else {
        // Create product: try API first if online, fall back to local-only
        const localId = crypto.randomUUID();
        const localProduct: ProductRecord = {
          id: localId,
          vendor_id: vendorId,
          name,
          name_creole: nameCreole || undefined,
          unit,
          current_price: Number(price),
          cost_price: costPrice !== '' ? Number(costPrice) : undefined,
          stock_quantity: Number(stock || '0'),
          low_stock_threshold: Number(threshold) || 0,
          is_active: true,
          photo_url: photoUrl,
        };
        if (navigator.onLine) {
          try {
            const { data } = await api.post<ProductRecord>('/products', apiPayload);
            // Coerce server response numbers and save
            data.current_price = Number(data.current_price);
            data.stock_quantity = Number(data.stock_quantity);
            data.low_stock_threshold = Number(data.low_stock_threshold);
            if (data.cost_price != null) data.cost_price = Number(data.cost_price);
            await putInStore('products', data);
          } catch {
            // API failed — save locally and queue for sync
            await putInStore('products', localProduct);
            await enqueue({ endpoint: '/products', method: 'POST', body: apiPayload });
          }
        } else {
          // Offline — save locally and queue for sync
          await putInStore('products', localProduct);
          await enqueue({ endpoint: '/products', method: 'POST', body: apiPayload });
        }
        onSaved(t('message.product_added'));
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
        {/* Photo section */}
        <div className="mb-1">
          {photoUrl ? (
            <div className="relative w-full h-36 rounded-2xl overflow-hidden">
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 right-2 flex gap-1.5">
                <button type="button" onClick={async () => { const { capturePhoto } = await import('../utils/imageCapture'); const url = await capturePhoto(); if (url) setPhotoUrl(url); }}
                  className="h-8 px-3 rounded-lg bg-black/50 text-white text-xs font-bold backdrop-blur-sm">{t('product.change_photo')}</button>
                <button type="button" onClick={() => setPhotoUrl(null)}
                  className="h-8 w-8 rounded-lg bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">
                  <RiCloseLine className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={async () => { const { capturePhoto } = await import('../utils/imageCapture'); const url = await capturePhoto(); if (url) setPhotoUrl(url); }}
              className="w-full h-28 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1.5 text-[var(--c-text2)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] transition-colors">
              <span className="text-2xl">📷</span>
              <span className="text-[13px] font-medium">{t('product.add_photo')}</span>
            </button>
          )}
        </div>

        <Field label={t('label.product_name')} required error={fieldErrors.name}>
          <input value={name} onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: '' })); }}
            className={`input-field ${fieldErrors.name ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`} autoFocus />
        </Field>
        <Field label={t('label.product_name_creole')}><input value={nameCreole} onChange={(e) => setNameCreole(e.target.value)} className="input-field" /></Field>
        <Field label={t('label.unit')}><select value={unit} onChange={(e) => setUnit(e.target.value)} className="input-field">{UNITS.map((u) => <option key={u} value={u}>{t(UNIT_KEYS[u] ?? u)}</option>)}</select></Field>
        <Field label={`${t('label.current_price')} (${t('label.currency')})`} required error={fieldErrors.price}>
          <input type="number" inputMode="decimal" value={price} onChange={(e) => { setPrice(e.target.value); setFieldErrors((f) => ({ ...f, price: '' })); }}
            className={`input-field ${fieldErrors.price ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`} min={0} />
        </Field>
        <Field label={`${t('label.cost_price')} (${t('label.currency')})`} error={fieldErrors.costPrice}>
          <input type="number" inputMode="decimal" value={costPrice} onChange={(e) => { setCostPrice(e.target.value); setFieldErrors((f) => ({ ...f, costPrice: '' })); }}
            className={`input-field ${fieldErrors.costPrice ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`} min={0} placeholder="—" />
        </Field>
        <Field label={editId ? t('label.stock') : t('label.initial_stock')} error={fieldErrors.stock}>
          <input type="number" inputMode="decimal" value={stock} onChange={(e) => { setStock(e.target.value); setFieldErrors((f) => ({ ...f, stock: '' })); }}
            className={`input-field ${fieldErrors.stock ? 'border-[#E76F51] ring-1 ring-[#E76F51]' : ''}`} min={0} />
        </Field>

        {/* Low stock alert threshold — prominent section */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <RiAlertLine className="h-[18px] w-[18px] text-amber-600" />
            <span className="text-[14px] font-bold text-amber-800">{t('threshold.label')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-amber-700">{t('threshold.when')}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center bg-white rounded-xl border border-amber-300 overflow-hidden">
              <button type="button"
                onClick={() => { const v = Math.max(0, Number(threshold) - 1); setThreshold(String(v)); setThresholdManuallyEdited(true); }}
                className="w-10 h-10 flex items-center justify-center text-amber-600 active:bg-amber-50">
                <RiSubtractLine className="h-4 w-4" />
              </button>
              <input type="number" inputMode="numeric" value={threshold}
                onChange={(e) => { setThreshold(e.target.value); setThresholdManuallyEdited(true); }}
                className="w-16 h-10 text-center text-[18px] font-bold text-amber-800 outline-none" min={0} />
              <button type="button"
                onClick={() => { setThreshold(String(Number(threshold) + 1)); setThresholdManuallyEdited(true); }}
                className="w-10 h-10 flex items-center justify-center text-amber-600 active:bg-amber-50">
                <RiAddLine className="h-4 w-4" />
              </button>
            </div>
            <span className="text-[13px] text-amber-700 font-medium">{t(UNIT_KEYS[unit] ?? unit)}</span>
          </div>
          <p className="text-[12px] text-amber-600 mt-2">{t('threshold.help')}</p>
          {Number(threshold) === 0 && (
            <p className="text-[12px] text-[var(--c-muted)] mt-1 italic">{t('threshold.disabled')}</p>
          )}
          {Number(threshold) > 0 && name && (
            <div className="mt-3 bg-white rounded-xl p-3 flex items-center gap-2 border border-amber-200">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[12px] text-amber-700 italic">
                {t('threshold.preview').replace('{name}', name || '...').replace('{threshold}', threshold).replace('{unit}', t(UNIT_KEYS[unit] ?? unit))}
              </span>
            </div>
          )}
        </div>
        {/* Supplier prices section (edit mode only) */}
        {editId && <SupplierPricesSection productId={editId} t={t} />}
        {/* Linked notes section (edit mode only) */}
        {editId && <LinkedNotesSection productId={editId} vendorId={vendorId} t={t} />}
        {error && <p className="text-[#E76F51] text-sm font-medium text-center animate-fade-in">{error}</p>}
        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="bg-[#FFF7ED] border border-[#F4A261] rounded-xl p-4 space-y-3 animate-fade-in">
            <p className="text-sm font-medium text-[#92400E]">{t('duplicate.warning')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setDuplicateWarning(false); }}
                className="flex-1 h-10 rounded-lg bg-white border border-gray-200 text-sm font-bold text-[var(--c-text2)]">
                {t('duplicate.cancel')}
              </button>
              <button type="button" onClick={() => { setDuplicateConfirmed(true); setDuplicateWarning(false); setTimeout(() => handleSubmit(new Event('submit') as unknown as FormEvent), 0); }}
                className="flex-1 h-10 rounded-lg bg-[#F4A261] text-white text-sm font-bold">
                {t('duplicate.confirm')}
              </button>
            </div>
          </div>
        )}
        <button type="submit" disabled={saving || !name || !price} className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40">
          {saving ? t('label.loading') : t('action.save')}
        </button>
      </form>
    </div>
  );
}

function SupplierPricesSection({ productId, t }: { productId: string; t: (k: string) => string }) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [spPrices, setSpPrices] = useState<SupplierPriceRecord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selSupplier, setSelSupplier] = useState('');
  const [spPrice, setSpPrice] = useState('');
  const [spUnit, setSpUnit] = useState('mamit');
  const vid = useAuthStore((s) => s.vendor?.id) ?? '';

  useEffect(() => {
    if (!vid) return;
    Promise.all([getVendorRecords('suppliers', vid), getVendorRecords('supplierPrices', vid)]).then(([s, p]) => {
      setSuppliers(s);
      setSpPrices(p.filter((pr) => pr.productId === productId));
    });
  }, [productId, vid]);

  const bestPrice = spPrices.length > 0 ? Math.min(...spPrices.map((p) => p.price)) : null;

  const handleAddPrice = async () => {
    if (!selSupplier || !spPrice) return;
    const record: SupplierPriceRecord = {
      id: crypto.randomUUID(), vendor_id: vid, supplierId: selSupplier, productId,
      price: Number(spPrice), unit: spUnit,
      lastUpdated: new Date().toISOString(), notes: null,
    };
    await putInStore('supplierPrices', record);
    setSpPrices((prev) => [...prev, record]);
    setShowAdd(false); setSpPrice(''); setSelSupplier('');
  };

  const getSupplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--c-text2)]">{t('suppliers.supplier_prices')}</p>
        <button type="button" onClick={() => setShowAdd(!showAdd)} className="text-xs font-bold text-[var(--c-primary)]">
          + {t('suppliers.add_price')}
        </button>
      </div>
      {spPrices.map((sp) => (
        <div key={sp.id} className="flex items-center justify-between py-1.5 px-2 bg-[var(--c-bg)] rounded-lg">
          <span className="text-sm text-[var(--c-text)]">{getSupplierName(sp.supplierId)}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--c-primary)]">{sp.price.toLocaleString()} {t('label.currency')}/{sp.unit}</span>
            {sp.price === bestPrice && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ {t('suppliers.best_price')}</span>
            )}
          </div>
        </div>
      ))}
      {showAdd && (
        <div className="bg-[var(--c-bg)] rounded-xl p-3 space-y-2">
          <select value={selSupplier} onChange={(e) => setSelSupplier(e.target.value)} className="input-field text-sm">
            <option value="">{t('suppliers.select')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" value={spPrice} onChange={(e) => setSpPrice(e.target.value)}
              placeholder={t('suppliers.price')} className="input-field flex-1 text-sm" min={0} />
            <select value={spUnit} onChange={(e) => setSpUnit(e.target.value)} className="input-field w-24 text-sm">
              {UNITS.map((u) => <option key={u} value={u}>{t(UNIT_KEYS[u] ?? u)}</option>)}
            </select>
          </div>
          <button type="button" onClick={handleAddPrice} disabled={!selSupplier || !spPrice}
            className="btn w-full h-9 rounded-lg bg-[var(--c-primary)] text-white text-sm font-bold disabled:opacity-40">
            {t('action.save')}
          </button>
        </div>
      )}
    </div>
  );
}

const NOTE_COLORS_INV: Record<string, string> = {
  yellow: 'bg-[#FEF9C3]', green: 'bg-[#D1FAE5]', blue: 'bg-[#DBEAFE]', pink: 'bg-[#FCE7F3]', white: 'bg-white',
};

function LinkedNotesSection({ productId, vendorId, t }: { productId: string; vendorId: string; t: (k: string) => string }) {
  const { notes, loading } = useLinkedNotes({ vendorId, productId });

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      <p className="text-sm font-medium text-[var(--c-text2)]">{t('notes.add_note_to_product')}</p>
      {loading && <p className="text-xs text-[var(--c-muted)]">{t('label.loading')}</p>}
      {!loading && notes.length === 0 && (
        <p className="text-xs text-[var(--c-muted)] italic">{t('notes.no_linked_notes')}</p>
      )}
      {notes.map((note) => (
        <div key={note.id} className={`p-3 rounded-xl text-[13px] ${NOTE_COLORS_INV[note.color] ?? NOTE_COLORS_INV.yellow}`}>
          {note.title && <p className="font-bold text-[var(--c-text)] truncate">{note.title}</p>}
          <p className="text-[var(--c-text2)] line-clamp-2 whitespace-pre-line">{note.body}</p>
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">
        {label}{required && <span className="text-[#E76F51] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[#E76F51] text-[13px] mt-1 animate-fade-in">{error}</p>}
    </div>
  );
}
