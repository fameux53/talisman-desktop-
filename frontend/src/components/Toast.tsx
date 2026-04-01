import { RiCheckLine, RiInformationLine, RiWifiOffLine, RiErrorWarningLine, RiAlertLine, RiCloseLine } from 'react-icons/ri';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'offline';

interface ToastProps {
  msg: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss?: () => void;
}

const cfg: Record<ToastVariant, { bg: string; border: string; textColor: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-[#D1FAE5]', border: 'border-l-4 border-l-[#10B981]', textColor: 'text-[#065F46]',
    icon: <RiCheckLine className="h-5 w-5 text-[#10B981] flex-shrink-0" />,
  },
  error: {
    bg: 'bg-[#FEE2E2]', border: 'border-l-4 border-l-[#EF4444]', textColor: 'text-[#991B1B]',
    icon: <RiErrorWarningLine className="h-5 w-5 text-[#EF4444] flex-shrink-0" />,
  },
  warning: {
    bg: 'bg-[#FEF3C7]', border: 'border-l-4 border-l-[#F59E0B]', textColor: 'text-[#92400E]',
    icon: <RiAlertLine className="h-5 w-5 text-[#F59E0B] flex-shrink-0" />,
  },
  info: {
    bg: 'bg-[#DBEAFE]', border: 'border-l-4 border-l-[#3B82F6]', textColor: 'text-[#1E40AF]',
    icon: <RiInformationLine className="h-5 w-5 text-[#3B82F6] flex-shrink-0" />,
  },
  offline: {
    bg: 'bg-[#DBEAFE]', border: 'border-l-4 border-l-[#3B82F6]', textColor: 'text-[#1E40AF]',
    icon: <RiWifiOffLine className="h-5 w-5 text-[#3B82F6] flex-shrink-0" />,
  },
};

export default function Toast({ msg, variant = 'success', duration = 3000, onDismiss }: ToastProps) {
  if (!msg) return null;
  const c = cfg[variant];

  return (
    <div className="fixed top-14 inset-x-0 z-[100] flex justify-center px-4 animate-toast-enter" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className={`w-full ${c.bg} ${c.border} ${c.textColor} rounded-xl shadow-lg overflow-hidden`}>
        <div className="flex items-center gap-2.5 py-3 px-4">
          {c.icon}
          <span className="flex-1 text-sm font-medium">{msg}</span>
          {onDismiss && (
            <button type="button" onClick={onDismiss} className="p-0.5 flex-shrink-0 opacity-60 hover:opacity-100">
              <RiCloseLine className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="h-[2px] bg-black/5">
          <div
            className="h-full bg-black/10 rounded-full"
            style={{ animation: `toast-progress ${duration}ms linear forwards` }}
          />
        </div>
      </div>
    </div>
  );
}
