import { useState, useEffect, useCallback, useMemo } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine, RiAddLine, RiCloseLine, RiCheckLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { getVendorRecords, putInStore, deleteFromStore, type CalendarEvent, type CalendarEventType } from '../services/db';
import { getAllCreditEntriesSecure } from '../services/secureDb';
import { formatCurrency } from '../utils/currency';
import Toast from '../components/Toast';

const EVENT_COLORS: Record<CalendarEventType, { bg: string; dot: string; text: string }> = {
  market_day: { bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  delivery: { bg: 'bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-700' },
  credit_due: { bg: 'bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-700' },
  expense_due: { bg: 'bg-red-50', dot: 'bg-red-500', text: 'text-red-700' },
  custom: { bg: 'bg-purple-50', dot: 'bg-purple-500', text: 'text-purple-700' },
  reminder: { bg: 'bg-cyan-50', dot: 'bg-cyan-500', text: 'text-cyan-700' },
};

const EVENT_EMOJI: Record<CalendarEventType, string> = {
  market_day: '📍', delivery: '📦', credit_due: '💳',
  expense_due: '🏠', custom: '📌', reminder: '🔔',
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  // 0=Sun..6=Sat → convert to 0=Mon..6=Sun
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function CalendarPage() {
  const { t, locale } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatDateStr(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState('');
  const [salesHeatmap, setSalesHeatmap] = useState<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    if (!vendorId) return;
    const [customEvents, transactions, creditEntries, expenses] = await Promise.all([
      getVendorRecords('calendarEvents', vendorId),
      getVendorRecords('transactions', vendorId),
      getAllCreditEntriesSecure(vendorId).catch(() => []),
      getVendorRecords('expenses', vendorId),
    ]);

    const allEvents: CalendarEvent[] = [...customEvents];

    // Auto-generate credit due date events
    for (const ce of creditEntries) {
      if (ce.entry_type === 'CREDIT_GIVEN' && ce.due_date) {
        allEvents.push({
          id: `credit_due_${ce.id}`,
          vendor_id: vendorId,
          title: `${ce.customer_name} — ${formatCurrency(ce.amount, locale)}`,
          date: ce.due_date,
          time: null,
          type: 'credit_due',
          color: 'amber',
          recurring: 'none',
          recurring_days: null,
          linked_customer_id: null,
          linked_supplier_id: null,
          notes: ce.description || null,
          is_completed: false,
          created_at: '',
        });
      }
    }

    // Auto-generate recurring expense events for current month
    for (const exp of expenses) {
      if (exp.is_recurring && exp.recurrence === 'monthly') {
        const expDate = exp.date.slice(8, 10); // day of month
        const monthDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${expDate}`;
        allEvents.push({
          id: `expense_due_${exp.id}`,
          vendor_id: vendorId,
          title: `${t(`expenses.cat_${exp.category}`)} — ${formatCurrency(exp.amount, locale)}`,
          date: monthDate,
          time: null,
          type: 'expense_due',
          color: 'red',
          recurring: 'monthly',
          recurring_days: null,
          linked_customer_id: null,
          linked_supplier_id: null,
          notes: exp.description,
          is_completed: false,
          created_at: '',
        });
      }
    }

    setEvents(allEvents);

    // Build sales heatmap
    const heatmap = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.transaction_type === 'SALE' && tx.created_at) {
        const d = tx.created_at.slice(0, 10);
        heatmap.set(d, (heatmap.get(d) ?? 0) + Number(tx.total_amount));
      }
    }
    setSalesHeatmap(heatmap);
  }, [vendorId, viewYear, viewMonth, locale, t]);

  useEffect(() => { refresh(); }, [refresh]);

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const dayNames = useMemo(() => {
    const names: Record<string, string[]> = {
      ht: ['Ln', 'Ma', 'Mè', 'Je', 'Va', 'Sa', 'Di'],
      fr: ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'],
      en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
    };
    return names[locale] ?? names.ht;
  }, [locale]);

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString(
    locale === 'ht' ? 'fr-HT' : locale, { month: 'long', year: 'numeric' }
  );

  const todayStr = formatDateStr(today);

  // Events for selected date
  const selectedEvents = useMemo(() =>
    events.filter(e => e.date === selectedDate).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [events, selectedDate]
  );

  // Events map for dot indicators on calendar
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventType[]>();
    for (const e of events) {
      const types = map.get(e.date) ?? [];
      if (!types.includes(e.type)) types.push(e.type);
      map.set(e.date, types);
    }
    return map;
  }, [events]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    await putInStore('calendarEvents', event);
    setShowForm(false);
    setToast(t('tools.event_saved'));
    setTimeout(() => setToast(''), 2500);
    refresh();
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteFromStore('calendarEvents', id);
    setToast(t('tools.event_deleted'));
    setTimeout(() => setToast(''), 2500);
    refresh();
  };

  const handleToggleComplete = async (event: CalendarEvent) => {
    await putInStore('calendarEvents', { ...event, is_completed: !event.is_completed });
    refresh();
  };

  const selectedDateLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(
    locale === 'ht' ? 'fr-HT' : locale, { weekday: 'long', day: 'numeric', month: 'long' }
  );

  return (
    <div className="space-y-4 animate-fade-up pb-20 md:pb-4">
      <Toast msg={toast} />

      <h1 className="font-heading text-2xl font-extrabold text-[var(--c-text)]">
        📅 {t('tools.calendar')}
      </h1>

      {/* Month navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={prevMonth} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-50 text-[var(--c-text2)]">
            <RiArrowLeftSLine className="h-5 w-5" />
          </button>
          <h2 className="font-heading font-bold text-lg text-[var(--c-text)] capitalize">{monthName}</h2>
          <button type="button" onClick={nextMonth} className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-gray-50 text-[var(--c-text2)]">
            <RiArrowRightSLine className="h-5 w-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[11px] font-bold text-[var(--c-muted)] uppercase">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dayEvents = eventsByDate.get(dateStr);
            const salesAmount = salesHeatmap.get(dateStr);
            const heatOpacity = salesAmount ? Math.min(0.3, salesAmount / 5000) : 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`h-10 rounded-xl flex flex-col items-center justify-center relative transition-all ${
                  isSelected ? 'bg-[var(--c-primary)] text-white shadow-sm' :
                  isToday ? 'bg-emerald-50 text-emerald-700 font-bold' :
                  'text-[var(--c-text)] hover:bg-gray-50'
                }`}
                style={!isSelected && !isToday && heatOpacity > 0 ? { backgroundColor: `rgba(45,106,79,${heatOpacity})` } : undefined}
              >
                <span className="text-[13px] font-medium">{day}</span>
                {dayEvents && dayEvents.length > 0 && (
                  <div className="flex gap-0.5 absolute bottom-1">
                    {dayEvents.slice(0, 3).map((type, j) => (
                      <div key={j} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : EVENT_COLORS[type]?.dot ?? 'bg-gray-400'}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-[15px] text-[var(--c-text)] capitalize">{selectedDateLabel}</h3>
          <button type="button" onClick={() => setShowForm(true)}
            className="h-8 px-3 rounded-lg gradient-primary text-white text-xs font-bold flex items-center gap-1">
            <RiAddLine className="h-3.5 w-3.5" /> {t('tools.new_event')}
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm text-[var(--c-text2)]">{t('tools.no_events')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedEvents.map(event => {
              const colors = EVENT_COLORS[event.type] ?? EVENT_COLORS.custom;
              const isAutoGenerated = event.id.startsWith('credit_due_') || event.id.startsWith('expense_due_');
              return (
                <div key={event.id} className={`card p-3.5 flex items-start gap-3 ${event.is_completed ? 'opacity-50' : ''}`}>
                  <span className="text-lg mt-0.5">{EVENT_EMOJI[event.type] ?? '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold text-[var(--c-text)] ${event.is_completed ? 'line-through' : ''}`}>
                      {event.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                        {t(`tools.type_${event.type}`)}
                      </span>
                      {event.time && <span className="text-[11px] text-[var(--c-muted)]">{event.time}</span>}
                    </div>
                    {event.notes && <p className="text-[12px] text-[var(--c-text2)] mt-1">{event.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!isAutoGenerated && (
                      <>
                        <button type="button" onClick={() => handleToggleComplete(event)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${event.is_completed ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-50 text-[var(--c-muted)]'}`}>
                          <RiCheckLine className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteEvent(event.id)}
                          className="h-7 w-7 rounded-full flex items-center justify-center text-[var(--c-muted)] hover:text-red-500 hover:bg-red-50">
                          <RiCloseLine className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sales heatmap legend */}
      {salesHeatmap.size > 0 && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] text-[var(--c-muted)]">{t('tools.sales_activity')}:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(45,106,79,0.05)' }} />
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(45,106,79,0.15)' }} />
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'rgba(45,106,79,0.3)' }} />
          </div>
        </div>
      )}

      {/* Add event form */}
      {showForm && (
        <EventForm
          t={t}
          vendorId={vendorId}
          selectedDate={selectedDate}
          onSave={handleSaveEvent}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Event Form ── */
function EventForm({ t, vendorId, selectedDate, onSave, onClose }: {
  t: (k: string) => string; vendorId: string; selectedDate: string;
  onSave: (e: CalendarEvent) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEventType>('custom');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState<'none' | 'weekly' | 'monthly'>('none');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: crypto.randomUUID(),
      vendor_id: vendorId,
      title: title.trim(),
      date: selectedDate,
      time: time || null,
      type,
      color: '',
      recurring,
      recurring_days: null,
      linked_customer_id: null,
      linked_supplier_id: null,
      notes: notes.trim() || null,
      is_completed: false,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl animate-slide-up md:relative md:z-10 md:rounded-3xl md:w-full md:max-w-[420px] md:max-h-[90vh] md:overflow-y-auto md:animate-fade-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>

        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="font-heading text-lg font-bold text-[var(--c-text)]">📅 {t('tools.new_event')}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--c-text2)]">
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-6 space-y-4">
          {/* Event type */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-2">{t('tools.event_type')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(EVENT_EMOJI) as CalendarEventType[]).map(k => (
                <button key={k} type="button" onClick={() => setType(k)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center ${
                    type === k ? `border-[var(--c-primary)] ${EVENT_COLORS[k].bg}` : 'border-gray-200 bg-gray-50'
                  }`}>
                  <span className="text-lg">{EVENT_EMOJI[k]}</span>
                  <span className="text-[9px] font-medium text-[var(--c-text)] leading-tight">{t(`tools.type_${k}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('tools.event_title')}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="input-field" placeholder={t('tools.event_title_placeholder')} autoFocus required />
          </div>

          {/* Time */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('tools.event_time')}</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input-field" />
          </div>

          {/* Recurring */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-2">{t('tools.recurring')}</label>
            <div className="flex gap-2">
              {(['none', 'weekly', 'monthly'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRecurring(r)}
                  className={`flex-1 h-9 rounded-xl text-xs font-bold transition-colors ${
                    recurring === r ? 'bg-[var(--c-primary)] text-white' : 'bg-gray-50 text-[var(--c-text2)]'
                  }`}>
                  {t(`tools.recurring_${r}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('tools.event_notes')}</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              className="input-field" placeholder={t('tools.event_notes_placeholder')} />
          </div>

          <button type="submit" disabled={!title.trim()}
            className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base disabled:opacity-40">
            {t('tools.save_event')}
          </button>
        </form>
      </div>
    </div>
  );
}
