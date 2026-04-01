import { useEffect } from 'react';
import { useSyncStore, type ConnStatus } from '../stores/syncStore';
import { useI18n } from '../i18n';

const cfg: Record<ConnStatus, { dot: string; pulse: boolean; textColor: string; label: string }> = {
  online:  { dot: 'bg-emerald-500', pulse: true,  textColor: 'text-[#2D6A4F]', label: 'status.online' },
  syncing: { dot: 'bg-[#F4A261]',   pulse: true,  textColor: 'text-[#F4A261]', label: 'status.syncing' },
  offline: { dot: 'bg-[#DC2626]',   pulse: false, textColor: 'text-[#DC2626]', label: 'status.offline' },
};

export default function SyncIndicator() {
  const status = useSyncStore((s) => s.status);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const processQueue = useSyncStore((s) => s.processQueue);
  const refreshPendingCount = useSyncStore((s) => s.refreshPendingCount);
  const { t } = useI18n();
  const c = cfg[status];

  // Refresh pending count on mount and when status changes
  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount, status]);

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (status === 'syncing' || !navigator.onLine) return;
    processQueue();
  };

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={status === 'syncing' || !navigator.onLine}
      className={`flex items-center gap-1.5 text-xs font-medium ${c.textColor} hover:opacity-80 transition-opacity disabled:cursor-default`}
      title={pendingCount > 0 ? t('sync.tap_to_sync') : undefined}
    >
      <span className="relative flex h-2 w-2">
        {c.pulse && (
          <span className={`absolute inset-0 rounded-full ${c.dot} animate-pulse-ring`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      <span>{t(c.label)}</span>
      {pendingCount > 0 && status !== 'syncing' && (
        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
          {pendingCount}
        </span>
      )}
    </button>
  );
}
