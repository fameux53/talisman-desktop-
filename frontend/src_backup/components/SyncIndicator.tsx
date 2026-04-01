import { useSyncStore, type ConnStatus } from '../stores/syncStore';
import { useI18n } from '../i18n';

const cfg: Record<ConnStatus, { dot: string; pulse: boolean; textColor: string; label: string }> = {
  online:  { dot: 'bg-emerald-500', pulse: true,  textColor: 'text-[#2D6A4F]', label: 'status.online' },
  syncing: { dot: 'bg-[#F4A261]',   pulse: true,  textColor: 'text-[#F4A261]', label: 'status.syncing' },
  offline: { dot: 'bg-[#DC2626]',   pulse: false, textColor: 'text-[#DC2626]', label: 'status.offline' },
};

export default function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const { t } = useI18n();
  const c = cfg[status];

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${c.textColor}`}>
      <span className="relative flex h-2 w-2">
        {c.pulse && (
          <span className={`absolute inset-0 rounded-full ${c.dot} animate-pulse-ring`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      <span>{t(c.label)}</span>
    </div>
  );
}
