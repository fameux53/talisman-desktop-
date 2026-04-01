import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiCloseLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { putInStore, getVendorRecords, type ProductRecord } from '../services/db';
import Toast from '../components/Toast';
import { parseProductList, type ParsedProduct } from '../utils/parseProductList';

const UNITS = ['mamit', 'sak', 'douzèn', 'pyès', 'liv', 'boutèy', 'galon', 'pakèt', 'bwat', 'rejim', 'tèt', 'ti sak', 'vè', 'bòl', 'pòsyon', 'woulo', 'pè', 'tib', 'mèt', 'sache'] as const;
const UNIT_KEYS: Record<string, string> = {
  mamit: 'unit.mamit', sak: 'unit.sak', 'douzèn': 'unit.douzen',
  'pyès': 'unit.pyes', liv: 'unit.liv', galon: 'unit.galon',
  'boutèy': 'boutèy', 'pakèt': 'pakèt', bwat: 'bwat',
  rejim: 'rejim', 'tèt': 'tèt', 'ti sak': 'ti sak', 'vè': 'vè',
  'bòl': 'bòl', 'pòsyon': 'pòsyon', woulo: 'woulo', 'pè': 'pè',
  tib: 'tib', 'mèt': 'mèt', sache: 'sache',
};

interface PreviewRow extends ParsedProduct {
  id: number;
  editedPrice: number | null;
  editedUnit: string;
  duplicate: boolean;
}

export default function BulkImportPage() {
  const { t } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);
  const enqueue = useSyncStore((s) => s.enqueue);
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing product names for duplicate detection
  useEffect(() => {
    if (!vendor?.id) return;
    getVendorRecords('products', vendor.id).then((products) => {
      setExistingNames(
        new Set(
          products.flatMap((p) => [
            p.name.toLowerCase(),
            ...(p.name_creole ? [p.name_creole.toLowerCase()] : []),
          ])
        )
      );
    });
  }, []);

  // Auto-grow textarea
  const handleTextChange = useCallback((value: string) => {
    setText(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, []);

  const parsed = useMemo(() => parseProductList(text), [text]);

  const handleParse = useCallback(() => {
    if (parsed.length === 0) return;
    const previewRows: PreviewRow[] = parsed.map((p, i) => ({
      ...p,
      id: i,
      editedPrice: p.price,
      editedUnit: p.unit,
      duplicate: existingNames.has(p.name.toLowerCase()),
    }));
    setRows(previewRows);
    setShowPreview(true);
  }, [parsed, existingNames]);

  const updateRowPrice = useCallback((id: number, price: number | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, editedPrice: price } : r)));
  }, []);

  const updateRowUnit = useCallback((id: number, unit: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, editedUnit: unit } : r)));
  }, []);

  const deleteRow = useCallback((id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const validRows = useMemo(() => rows.filter((r) => r.name.length > 0), [rows]);

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setSaving(true);
    try {
      let count = 0;
      for (const row of validRows) {
        const product: ProductRecord = {
          id: crypto.randomUUID(),
          vendor_id: vendor?.id ?? '',
          name: row.name,
          name_creole: row.name,
          unit: row.editedUnit,
          current_price: row.editedPrice ?? 0,
          stock_quantity: 0,
          low_stock_threshold: ({
            mamit: 3, sak: 2, 'douzèn': 2, liv: 5, 'boutèy': 5, 'pyès': 10,
            'pakèt': 5, bwat: 3, galon: 2, rejim: 2, 'vè': 10, sache: 20,
          } as Record<string, number>)[row.editedUnit] ?? 5,
          is_active: true,
        };
        await putInStore('products', product);
        await enqueue({
          endpoint: '/products',
          method: 'POST',
          body: {
            name: product.name,
            name_creole: product.name_creole,
            unit: product.unit,
            current_price: String(product.current_price),
            stock_quantity: '0',
            low_stock_threshold: String(product.low_stock_threshold),
          },
        });
        count++;
      }

      localStorage.setItem(`tlsm_catalog_setup_done_${vendor?.id ?? ''}`, 'true');
      const msg = t('import.success').replace('{count}', String(count));
      setToast(msg);
      setTimeout(() => navigate('/inventory', { replace: true }), 1200);
    } catch (err) {
      console.error('[Talisman] Bulk import failed:', err);
      setToast(t('error.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const addBtnText = t('import.add_products').replace('{count}', String(validRows.length));

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col">
      <Toast msg={toast} />

      {/* Header */}
      <div className="gradient-primary px-5 pt-10 pb-6 text-white">
        <button
          type="button"
          onClick={() => (showPreview ? setShowPreview(false) : navigate(-1))}
          className="flex items-center gap-1 text-white/80 text-sm mb-3"
        >
          <RiArrowLeftLine className="h-4 w-4" />
          {t('action.back')}
        </button>
        <h1 className="font-heading text-2xl font-extrabold">{t('import.title')}</h1>
      </div>

      <div className="flex-1 px-4 -mt-3 pb-32 space-y-4">
        {/* Instructions */}
        <div className="bg-[#F0F9FF] rounded-2xl p-4 flex gap-3">
          <span className="text-2xl flex-shrink-0">📝</span>
          <div>
            <p className="text-sm text-[#1E40AF]">{t('import.instructions')}</p>
            <pre className="mt-2 text-xs text-[#1E40AF]/70 bg-white/60 rounded-xl p-3 font-mono whitespace-pre-wrap">
              {t('import.example')}
            </pre>
          </div>
        </div>

        {!showPreview ? (
          <>
            {/* Auto-growing textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={t('import.placeholder')}
              className="w-full rounded-2xl border border-gray-200 bg-card text-primary p-4 font-body resize-none focus:ring-2 focus:ring-brand-green-500 focus:border-transparent"
              style={{ fontSize: '15px', lineHeight: 1.8, minHeight: '200px' }}
            />

            {text.trim() && (
              <p className="text-xs text-[var(--c-muted)] text-center">
                {t('import.lines_parsed').replace('{count}', String(parsed.length))}
              </p>
            )}

            {/* Parse button */}
            <button
              type="button"
              disabled={parsed.length === 0}
              onClick={handleParse}
              className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40"
            >
              {t('import.parse_button')} ({parsed.length})
            </button>
          </>
        ) : (
          <>
            {/* Preview title */}
            <h2 className="font-heading font-bold text-lg text-[var(--c-text)]">
              {t('import.preview_title')}
            </h2>

            {/* Preview rows */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`bg-card rounded-xl p-3 space-y-2 relative ${
                    row.duplicate ? 'ring-1 ring-amber-300' : ''
                  }`}
                >
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-red-50 text-gray-300 hover:text-[#E76F51] transition-colors"
                    aria-label={t('import.delete_row')}
                  >
                    <RiCloseLine className="h-5 w-5" />
                  </button>

                  {/* Name row with emoji */}
                  <div className="flex items-center gap-2 pr-8">
                    {row.emoji ? (
                      <span className="text-xl flex-shrink-0">{row.emoji}</span>
                    ) : (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-heading font-bold text-sm flex-shrink-0"
                        style={{ background: 'var(--gradient-teal)' }}>
                        {row.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[15px] font-semibold text-[var(--c-text)] truncate">
                      {row.name}
                    </span>
                  </div>

                  {/* Duplicate warning */}
                  {row.duplicate && (
                    <p className="text-xs text-amber-600 font-medium ml-10">
                      ⚠️ {t('import.already_exists')}
                    </p>
                  )}

                  {/* Price + Unit row */}
                  <div className="flex items-center gap-2 ml-10">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={row.editedPrice ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          updateRowPrice(row.id, val);
                        }}
                        placeholder="0"
                        className={`w-full h-9 text-sm px-3 pr-7 rounded-lg border focus:ring-1 focus:ring-[var(--c-primary)] focus:border-transparent ${
                          row.editedPrice === null
                            ? 'border-amber-300 bg-amber-50/50'
                            : 'border-gray-200'
                        }`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--c-muted)] font-medium">G</span>
                    </div>
                    <select
                      value={row.editedUnit}
                      onChange={(e) => updateRowUnit(row.id, e.target.value)}
                      className="h-9 text-sm px-2 rounded-lg border border-gray-200 bg-card text-primary focus:ring-1 focus:ring-brand-green-500 focus:border-transparent"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{t(UNIT_KEYS[u] ?? u)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price missing hint */}
                  {row.editedPrice === null && (
                    <p className="text-[11px] text-amber-500 ml-10">{t('import.price_missing')}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Empty state */}
            {rows.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[var(--c-muted)]">{t('import.no_valid')}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="button"
              disabled={validRows.length === 0 || saving}
              onClick={handleSubmit}
              className="btn w-full h-[52px] gradient-primary text-white text-lg font-heading font-bold rounded-xl shadow-md disabled:opacity-40 gap-2"
            >
              {saving ? t('label.loading') : addBtnText}
              {!saving && <RiArrowRightLine className="h-5 w-5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
