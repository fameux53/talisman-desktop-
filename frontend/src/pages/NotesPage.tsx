import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RiAddLine, RiPushpinLine, RiPushpinFill, RiDeleteBinLine, RiCloseLine, RiSearchLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { getVendorRecords, putInStore, deleteFromStore, type NoteRecord } from '../services/db';
import Toast from '../components/Toast';

const NOTE_COLORS = ['yellow', 'green', 'blue', 'pink', 'white'] as const;
const COLOR_CLASSES: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'bg-[#FEF9C3]', border: 'border-[#FDE68A]' },
  green:  { bg: 'bg-[#D1FAE5]', border: 'border-[#A7F3D0]' },
  blue:   { bg: 'bg-[#DBEAFE]', border: 'border-[#BFDBFE]' },
  pink:   { bg: 'bg-[#FCE7F3]', border: 'border-[#FBCFE8]' },
  white:  { bg: 'bg-white',     border: 'border-gray-200' },
};

const CATEGORIES = ['supplier', 'customer', 'order', 'reminder', 'general'] as const;

type NoteCategory = typeof CATEGORIES[number] | null;

export default function NotesPage() {
  const { t, locale } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<'pinned' | 'all' | typeof CATEGORIES[number]>('all');
  const [editNote, setEditNote] = useState<NoteRecord | null>(null);
  const [toast, setToast] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const createNew = useCallback(() => {
    const now = new Date().toISOString();
    setEditNote({
      id: crypto.randomUUID(),
      vendor_id: vendorId,
      title: '',
      body: '',
      color: 'yellow',
      pinned: false,
      category: null,
      linked_product_id: null,
      linked_customer_id: null,
      created_at: now,
      updated_at: now,
    });
  }, [vendorId]);

  // Auto-open new note if navigated with ?new=1 (from FAB quick note)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      createNew();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, createNew, setSearchParams]);

  const refresh = useCallback(async () => {
    const all = await getVendorRecords('notes', vendorId);
    all.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
    setNotes(all);
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Escape key closes topmost modal (delete confirm > note editor)
  useEffect(() => {
    if (!deleteConfirm) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDeleteConfirm(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteConfirm]);

  const saveNote = async (note: NoteRecord) => {
    await putInStore('notes', note);
    setEditNote(null);
    setToast(t('notes.saved'));
    setTimeout(() => setToast(''), 2500);
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteFromStore('notes', id);
    setDeleteConfirm(null);
    if (editNote?.id === id) setEditNote(null);
    setToast(t('notes.deleted'));
    setTimeout(() => setToast(''), 2500);
    refresh();
  };

  const togglePin = async (note: NoteRecord) => {
    await putInStore('notes', { ...note, pinned: !note.pinned, updated_at: new Date().toISOString() });
    refresh();
  };

  // Filter notes
  const filtered = notes.filter((n) => {
    if (search) {
      const q = search.toLowerCase();
      if (!n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false;
    }
    if (filterCat === 'pinned') return n.pinned;
    if (filterCat !== 'all') return n.category === filterCat;
    return true;
  });

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('time.just_now');
    if (mins < 60) return t('time.minutes_ago').replace('{n}', String(mins));
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('time.hours_ago').replace('{n}', String(hrs));
    const days = Math.floor(hrs / 24);
    if (days < 7) return t('time.days_ago').replace('{n}', String(days));
    return new Date(dateStr).toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, { day: 'numeric', month: 'short' });
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold text-primary">📝 {t('notes.title')}</h1>
        <button type="button" onClick={createNew}
          className="btn h-10 px-4 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 shadow-sm">
          <RiAddLine className="h-4 w-4" /> {t('notes.new')}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('notes.search')}
          className="input-field pl-9 h-10 text-sm" />
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {(['all', 'pinned', ...CATEGORIES] as const).map((cat) => (
          <button key={cat} type="button" onClick={() => setFilterCat(cat)}
            className={`h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              filterCat === cat
                ? 'gradient-primary text-white shadow-sm'
                : 'bg-white text-secondary border border-gray-200'
            }`}>
            {cat === 'all' ? t('notes.all')
              : cat === 'pinned' ? `📌 ${t('notes.pinned')}`
              : t(`notes.cat_${cat}`)}
          </button>
        ))}
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="text-4xl">📝</p>
          <p className="text-secondary">{t('notes.empty')}</p>
          <button type="button" onClick={createNew}
            className="btn h-10 px-5 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 mx-auto">
            <RiAddLine className="h-4 w-4" /> {t('notes.new')}
          </button>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
          {filtered.map((note) => {
            const cc = COLOR_CLASSES[note.color] ?? COLOR_CLASSES.yellow;
            return (
              <div key={note.id}
                onClick={() => setEditNote(note)}
                className={`${cc.bg} border ${cc.border} rounded-2xl p-4 shadow-sm cursor-pointer break-inside-avoid transition-all hover:shadow-md active:scale-[0.98] relative group`}>
                {/* Pin indicator */}
                {note.pinned && (
                  <RiPushpinFill className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-[var(--c-primary)] opacity-70" />
                )}
                {/* Category badge */}
                {note.category && (
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-secondary bg-black/5 rounded px-1.5 py-0.5 mb-2">
                    {t(`notes.cat_${note.category}`)}
                  </span>
                )}
                {/* Title */}
                {note.title && note.title !== note.body.split('\n')[0]?.slice(0, 50) && (
                  <p className="font-heading font-bold text-[14px] text-primary mb-1 truncate pr-5">{note.title}</p>
                )}
                {/* Body preview with fade-out */}
                <div className="relative">
                  <p className="text-[13px] text-primary leading-relaxed line-clamp-5 whitespace-pre-line">{note.body || '\u00A0'}</p>
                  {note.body.split('\n').length > 5 && (
                    <div className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t ${
                      note.color === 'yellow' ? 'from-[#FEF9C3]' :
                      note.color === 'green' ? 'from-[#D1FAE5]' :
                      note.color === 'blue' ? 'from-[#DBEAFE]' :
                      note.color === 'pink' ? 'from-[#FCE7F3]' :
                      'from-white'
                    } to-transparent`} />
                  )}
                </div>
                {/* Linked entity badges */}
                {(note.linked_product_id || note.linked_customer_id) && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {note.linked_product_id && (
                      <span className="text-[10px] font-medium bg-black/5 rounded-full px-2 py-0.5">🛒 {t('label.product')}</span>
                    )}
                    {note.linked_customer_id && (
                      <span className="text-[10px] font-medium bg-black/5 rounded-full px-2 py-0.5">👤 {t('label.customer')}</span>
                    )}
                  </div>
                )}
                {/* Timestamp */}
                <p className="text-[11px] text-muted mt-2">{formatTimeAgo(note.updated_at)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create note sheet */}
      {editNote && (
        <NoteEditor
          note={editNote}
          t={t}
          onSave={saveNote}
          onClose={() => setEditNote(null)}
          onDelete={() => setDeleteConfirm(editNote.id)}
          onTogglePin={() => togglePin(editNote)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-[300px] w-full mx-4 animate-fade-up shadow-2xl space-y-4">
            <p className="font-heading font-bold text-lg text-center text-primary">{t('notes.delete_confirm')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-sm text-secondary">
                {t('action.cancel')}
              </button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-11 rounded-xl bg-[#E76F51] text-white font-bold text-sm">
                {t('notes.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Note Editor Sheet ── */
function NoteEditor({ note, t, onSave, onClose, onDelete, onTogglePin }: {
  note: NoteRecord;
  t: (k: string) => string;
  onSave: (n: NoteRecord) => void;
  onClose: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [color, setColor] = useState(note.color);
  const [category, setCategory] = useState<NoteCategory>(note.category);
  const [pinned, setPinned] = useState(note.pinned);
  const [autoSaved, setAutoSaved] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    setTimeout(() => bodyRef.current?.focus(), 100);
  }, []);

  // Auto-grow textarea
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.height = 'auto';
      bodyRef.current.style.height = Math.max(150, bodyRef.current.scrollHeight) + 'px';
    }
  }, [body]);

  const buildNote = useCallback((): NoteRecord | null => {
    if (!body.trim() && !title.trim()) return null;
    const autoTitle = title.trim() || body.trim().split('\n')[0].slice(0, 30);
    return { ...note, title: autoTitle, body: body.trim(), color, category, updated_at: new Date().toISOString() };
  }, [note, title, body, color, category]);

  // Auto-save after 1s of no typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const built = buildNote();
      if (built && (built.body !== note.body || built.title !== note.title || built.color !== note.color || built.category !== note.category)) {
        putInStore('notes', built);
        setAutoSaved(true);
        setTimeout(() => setAutoSaved(false), 1500);
      }
    }, 1000);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, body, color, category, buildNote, note]);

  const handleSave = () => {
    const built = buildNote();
    if (built) onSave(built);
  };

  return (
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden animate-slide-up md:relative md:z-10 md:rounded-3xl md:w-full md:max-w-[520px] md:max-h-[80vh] md:animate-fade-up"
        style={{ height: '80vh' }} onClick={(e) => e.stopPropagation()}>
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header — Save left, Delete + Close right */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleSave}
              className="h-9 px-5 rounded-xl gradient-primary text-white font-bold text-sm shadow-sm">
              {t('action.save')}
            </button>
            {autoSaved && (
              <span className="text-xs text-emerald-600 font-medium animate-fade-in">✓ {t('notes.saved')}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onDelete}
              className="h-8 w-8 rounded-full flex items-center justify-center text-secondary hover:bg-red-50 hover:text-[#E76F51] transition-colors"
              aria-label={t('notes.delete')}>
              <RiDeleteBinLine className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-secondary hover:bg-page"
              aria-label={t('action.cancel')}>
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Title input */}
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder={t('notes.title_placeholder')}
          className="px-5 py-2 text-lg font-heading font-bold bg-transparent outline-none text-primary placeholder:text-muted" />

        {/* Body textarea */}
        <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={t('notes.placeholder')}
          className="flex-1 px-5 py-2 text-[15px] leading-relaxed bg-transparent outline-none resize-none text-primary placeholder:text-muted scrollbar-hide" />

        {/* Bottom toolbar — Color, Category, Pin */}
        <div className="px-5 py-3 border-t border-[var(--c-border)] space-y-3">
          {/* Color picker row */}
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium text-secondary">{t('notes.color')}:</span>
            <div className="flex gap-2">
              {NOTE_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    COLOR_CLASSES[c].bg
                  } ${color === c ? 'border-[var(--c-primary)] scale-110 shadow-sm' : 'border-gray-200'}`} />
              ))}
            </div>
          </div>
          {/* Category + Pin row */}
          <div className="flex items-center justify-between">
            <select value={category ?? ''} onChange={(e) => setCategory((e.target.value || null) as NoteCategory)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white text-primary font-medium outline-none cursor-pointer">
              <option value="">{t('notes.cat_general')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`notes.cat_${c}`)}</option>
              ))}
            </select>
            <button type="button" onClick={() => { setPinned(!pinned); onTogglePin(); }}
              className={`h-9 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors ${
                pinned
                  ? 'bg-[#F0FDF4] text-[var(--c-primary)] border border-[var(--c-primary)]'
                  : 'bg-white text-secondary border border-gray-200'
              }`}>
              {pinned ? <RiPushpinFill className="h-3.5 w-3.5" /> : <RiPushpinLine className="h-3.5 w-3.5" />}
              {pinned ? t('notes.unpin') : t('notes.pin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
