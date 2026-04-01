import { useState, useEffect, useRef } from 'react';
import { putInStore, type NoteRecord } from '../services/db';

interface QuickNoteSheetProps {
  vendorId: string;
  t: (k: string) => string;
  onClose: () => void;
  onOpenFull: () => void;
}

export default function QuickNoteSheet({ vendorId, t, onClose, onOpenFull }: QuickNoteSheetProps) {
  const [body, setBody] = useState('');
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 150);
  }, []);

  // Auto-grow
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.max(120, textareaRef.current.scrollHeight) + 'px';
    }
  }, [body]);

  const saveAndClose = async () => {
    if (body.trim()) {
      const now = new Date().toISOString();
      const note: NoteRecord = {
        id: crypto.randomUUID(),
        vendor_id: vendorId,
        title: body.trim().split('\n')[0].slice(0, 30),
        body: body.trim(),
        color: 'yellow',
        pinned: false,
        category: 'general',
        linked_product_id: null,
        linked_customer_id: null,
        created_at: now,
        updated_at: now,
      };
      await putInStore('notes', note);
      setSaved(true);
      setTimeout(onClose, 600);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={saveAndClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-[#FEF9C3] rounded-t-[28px] shadow-2xl animate-slide-up md:absolute md:bottom-6 md:right-6 md:left-auto md:w-[340px] md:rounded-3xl md:top-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-amber-300/60 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-heading text-sm font-bold text-amber-800">📝 {t('notes.quick')}</span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-700 font-medium animate-fade-in">✓</span>}
            <button type="button" onClick={saveAndClose}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-lg hover:bg-amber-200/50 transition-colors">
              {t('action.save')}
            </button>
          </div>
        </div>

        {/* Body only — minimal */}
        <div className="px-4 pb-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('notes.placeholder')}
            className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed text-amber-900 placeholder:text-amber-400 min-h-[120px]"
          />
        </div>

        {/* "All options" link */}
        <div className="px-4 pb-4 flex justify-between items-center">
          <button type="button" onClick={onOpenFull}
            className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors">
            {t('notes.all_options')}
          </button>
          <span className="text-[10px] text-amber-400 hidden md:inline">Ctrl+Shift+N</span>
        </div>
      </div>
    </div>
  );
}
