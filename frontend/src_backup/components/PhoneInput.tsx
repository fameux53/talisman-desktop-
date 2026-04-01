import { RiCheckLine } from 'react-icons/ri';
import { useI18n } from '../i18n';

interface PhoneInputProps {
  id?: string;
  name?: string;
  value: string; // full number with +509 prefix
  onChange: (fullNumber: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

export default function PhoneInput({ id, name, value, onChange, error, autoFocus }: PhoneInputProps) {
  const { t } = useI18n();
  // Extract local part (strip +509 prefix if present)
  const local = value.startsWith('+509') ? value.slice(4) : value.replace(/\D/g, '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    onChange(`+509${digits}`);
  };

  // Format for display: "37 12 56 78"
  const formatted = local.replace(/(\d{2})(?=\d)/g, '$1 ');
  const isComplete = local.length === 8;

  return (
    <div>
      <div className={`flex items-center input-field pr-2 ${error ? 'border-red-400 ring-1 ring-red-400' : ''}`}>
        <span className="text-sm font-medium text-[var(--c-text2)] mr-2 flex-shrink-0 select-none">+509</span>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={formatted}
          onChange={handleChange}
          className="flex-1 bg-transparent outline-none text-base font-body"
          placeholder="37 00 12 34"
          maxLength={11} // 8 digits + 3 spaces
          autoFocus={autoFocus}
        />
        {isComplete && <RiCheckLine className="h-5 w-5 text-emerald-500 flex-shrink-0" />}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs text-[#6B7280]">{t('auth.phone_helper')}</span>
        <span className={`text-xs font-medium ${isComplete ? 'text-emerald-600' : 'text-[#6B7280]'}`}>{local.length}/8</span>
      </div>
    </div>
  );
}
