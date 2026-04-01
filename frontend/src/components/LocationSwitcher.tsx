import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiMapPinLine, RiArrowDownSLine, RiAddLine, RiBarChart2Line, RiCheckLine } from 'react-icons/ri';
import { useLocationStore } from '../stores/locationStore';
import { useI18n } from '../i18n';

export default function LocationSwitcher() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { locations, activeLocation, activeLocationId, setActiveLocation } = useLocationStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Always show — even with 1 location (allows adding more)
  const displayName = activeLocationId === 'all'
    ? t('locations.all_locations')
    : activeLocation?.name ?? t('locations.title');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-medium text-[var(--c-text2)] hover:bg-[var(--c-bg)] transition-colors max-w-[160px]"
      >
        <RiMapPinLine className="h-3.5 w-3.5 text-[var(--c-primary)] flex-shrink-0" />
        <span className="truncate">{displayName}</span>
        <RiArrowDownSLine className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 min-w-[220px] z-50 animate-fade-in">
          {/* Location list */}
          {locations.filter((l) => l.is_active).map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => { setActiveLocation(loc.id); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-sm transition-colors ${
                loc.id === activeLocationId
                  ? 'bg-[#F0FDF4] text-[var(--c-primary)] font-bold'
                  : 'text-[var(--c-text)] hover:bg-[var(--c-bg)]'
              }`}
            >
              <RiMapPinLine className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate">{loc.name}</p>
                {loc.address && <p className="text-[11px] text-[var(--c-muted)] truncate">{loc.address}</p>}
              </div>
              {loc.id === activeLocationId && <RiCheckLine className="h-4 w-4 text-[var(--c-primary)] flex-shrink-0" />}
            </button>
          ))}

          {/* Divider */}
          <div className="h-px bg-gray-100 my-1.5" />

          {/* All locations combined */}
          {locations.length > 1 && (
            <button
              type="button"
              onClick={() => { setActiveLocation('all'); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-sm transition-colors ${
                activeLocationId === 'all'
                  ? 'bg-[#EFF6FF] text-[#3B82F6] font-bold'
                  : 'text-[var(--c-text)] hover:bg-[var(--c-bg)]'
              }`}
            >
              <RiBarChart2Line className="h-4 w-4 flex-shrink-0" />
              <span>{t('locations.all_locations')}</span>
              {activeLocationId === 'all' && <RiCheckLine className="h-4 w-4 text-[#3B82F6] flex-shrink-0 ml-auto" />}
            </button>
          )}

          {/* Add location */}
          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/locations'); }}
            className="w-full px-3 py-2.5 text-left flex items-center gap-2.5 text-sm text-[var(--c-primary)] hover:bg-[var(--c-bg)] transition-colors"
          >
            <RiAddLine className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{t('locations.add')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
