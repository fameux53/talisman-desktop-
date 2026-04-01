import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  RiHome5Fill, RiHome5Line,
  RiShoppingCart2Fill, RiShoppingCart2Line,
  RiArchive2Fill, RiArchive2Line,
  RiHandCoinFill, RiHandCoinLine,
  RiBarChart2Fill, RiBarChart2Line,
  RiWifiOffLine, RiLogoutBoxRLine,
} from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import SyncIndicator from './SyncIndicator';
import LanguageSelector from './LanguageSelector';

interface Tab {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string }>;
  IconActive: React.ComponentType<{ className?: string }>;
}

const tabs: Tab[] = [
  { to: '/', labelKey: 'nav.home', Icon: RiHome5Line, IconActive: RiHome5Fill },
  { to: '/sales', labelKey: 'nav.sales', Icon: RiShoppingCart2Line, IconActive: RiShoppingCart2Fill },
  { to: '/inventory', labelKey: 'nav.inventory', Icon: RiArchive2Line, IconActive: RiArchive2Fill },
  { to: '/credit', labelKey: 'nav.credit', Icon: RiHandCoinLine, IconActive: RiHandCoinFill },
  { to: '/reports', labelKey: 'nav.reports', Icon: RiBarChart2Line, IconActive: RiBarChart2Fill },
];

const CONTAINER = 'max-w-[480px] mx-auto';

export default function Layout() {
  const { t } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);
  const connStatus = useSyncStore((s) => s.status);

  const [showOffline, setShowOffline] = useState(connStatus === 'offline');
  const [showReconnected, setShowReconnected] = useState(false);
  const prevStatus = useRef(connStatus);

  useEffect(() => {
    if (connStatus === 'offline') {
      setShowOffline(true);
      setShowReconnected(false);
    } else if (prevStatus.current === 'offline' && connStatus !== 'offline') {
      setShowOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowOffline(false);
    }
    prevStatus.current = connStatus;
  }, [connStatus]);

  return (
    <div className="min-h-screen bg-[#F0EDE8] sm:bg-gradient-to-b sm:from-[#EEECE8] sm:to-[#E4E2DE]">
      {/* Desktop branding — visible only on wider screens */}
      <div className="hidden sm:block text-center pt-3 pb-1">
        <p className="font-heading text-sm font-semibold text-[#9CA3AF]">MarketMama — {t('app.tagline')}</p>
      </div>
      {/* Phone-sized container */}
      <div className={`${CONTAINER} min-h-screen sm:min-h-0 flex flex-col bg-[var(--c-bg)] sm:shadow-2xl sm:rounded-t-2xl`}>
        {/* ── Offline / Reconnected banner ── */}
        {showOffline && (
          <div className="bg-[#FEF3C7] text-[#92400E] h-9 flex items-center justify-center gap-2 text-[13px] font-medium animate-fade-in z-50">
            <RiWifiOffLine className="h-4 w-4 flex-shrink-0" />
            <span className="truncate px-2">{t('offline.banner')}</span>
          </div>
        )}
        {showReconnected && (
          <div className="bg-[#D1FAE5] text-[#065F46] h-9 flex items-center justify-center gap-2 text-[13px] font-medium animate-fade-in z-50">
            <span>{t('offline.reconnected')}</span>
          </div>
        )}

        {/* ── Top bar ── */}
        <header className="sticky top-0 z-40 bg-[var(--c-nav-bg)] backdrop-blur-md border-b border-[var(--c-nav-border)]">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛍️</span>
              <span className="font-heading text-xl font-extrabold text-[var(--c-primary)]">
                MarketMama
              </span>
            </div>
            <div className="flex items-center gap-2">
              <SyncIndicator />
              <LanguageSelector />
              <button
                type="button"
                onClick={() => { useAuthStore.getState().logout(); }}
                className="flex items-center justify-center h-8 w-8 rounded-full text-[var(--c-text2)] hover:text-[#E76F51] transition-colors"
                aria-label={t('auth.logout')}
                title={t('auth.logout')}
              >
                <RiLogoutBoxRLine className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-y-auto pb-20 page-enter">
          <Outlet />
        </main>

        {/* ── Bottom navigation ── */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full z-40 bg-[var(--c-nav-bg)] backdrop-blur-lg border-t border-[var(--c-nav-border)] safe-area-pb" style={{ maxWidth: 480 }}>
          <div className="flex justify-around h-16">
            {tabs.map(({ to, labelKey, Icon, IconActive }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center flex-1 pt-1.5 pb-1 transition-colors ${
                    isActive ? 'text-[var(--c-primary)]' : 'text-gray-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-[var(--c-primary)]" />
                    )}
                    {isActive ? (
                      <IconActive className="h-6 w-6" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                    <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {t(labelKey)}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
