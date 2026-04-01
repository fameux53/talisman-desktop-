import { useMemo } from 'react';

interface DatePickerProps {
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
  t: (key: string) => string;
  label?: string;
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export default function DatePicker({ value, onChange, t, label }: DatePickerProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 2; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  // Parse current value
  const parts = value ? value.split('-').map(Number) : [0, 0, 0];
  const selYear = parts[0] || 0;
  const selMonth = parts[1] || 0;
  const selDay = parts[2] || 0;

  const maxDays = selYear && selMonth ? daysInMonth(selMonth, selYear) : 31;

  const update = (y: number, m: number, d: number) => {
    if (y && m && d) {
      const clamped = Math.min(d, daysInMonth(m, y));
      onChange(`${y}-${String(m).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`);
    } else {
      onChange('');
    }
  };

  const selectClass = "h-11 rounded-lg border border-[var(--c-border)] bg-white px-2 text-base font-body focus:ring-2 focus:ring-[var(--c-primary)] focus:border-transparent";

  return (
    <div>
      {label && <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{label}</label>}
      <div className="grid grid-cols-3 gap-2">
        {/* Day */}
        <select
          value={selDay || ''}
          onChange={(e) => update(selYear || currentYear, selMonth || 1, Number(e.target.value))}
          className={selectClass}
          aria-label={t('date.day')}
        >
          <option value="">{t('date.day')}</option>
          {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Month */}
        <select
          value={selMonth || ''}
          onChange={(e) => update(selYear || currentYear, Number(e.target.value), selDay || 1)}
          className={selectClass}
          aria-label={t('date.month')}
        >
          <option value="">{t('date.month')}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{t(`month.${m}`)}</option>
          ))}
        </select>

        {/* Year */}
        <select
          value={selYear || ''}
          onChange={(e) => update(Number(e.target.value), selMonth || 1, selDay || 1)}
          className={selectClass}
          aria-label={t('date.year')}
        >
          <option value="">{t('date.year')}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
