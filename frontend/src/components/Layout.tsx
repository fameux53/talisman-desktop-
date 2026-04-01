import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  RiHome5Fill, RiHome5Line,
  RiArchive2Fill, RiArchive2Line,
  RiPieChart2Fill, RiPieChart2Line,
  RiHandCoinFill, RiHandCoinLine,
  RiAddLine, RiWifiOffLine, RiLogoutBoxRLine, RiHistoryLine,
  RiMoonLine, RiSunLine,
} from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useThemeStore } from '../stores/themeStore';
import SyncIndicator from './SyncIndicator';
import LanguageSelector from './LanguageSelector';
import GlobalSearch from './GlobalSearch';
import SideNav from './SideNav';
import TalismanLogo from './TalismanLogo';
import SalesPage from '../pages/SalesPage';
import Receipt from './Receipt';
import Calculator from './Calculator';
import QuickNoteSheet from './QuickNoteSheet';
import LocationSwitcher from './LocationSwitcher';
import { useLocationStore } from '../stores/locationStore';
import { useElectronBridge } from '../hooks/useElectron';
import OnboardingTour from './OnboardingTour';
import Toast from './Toast';
import { consumeProtectedRouteToast } from './ProtectedRoute';
import { RiCalculatorLine, RiBrainLine } from 'react-icons/ri';

export default function Layout() {
  useElectronBridge();
  const { t } = useI18n();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const connStatus = useSyncStore((s) => s.status);
  const { ensureDefaultLocation } = useLocationStore();
  const [showSalesSheet, setShowSalesSheet] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [calcPrefill, setCalcPrefill] = useState<number | null>(null);
  const [receiptData, setReceiptData] = useState<{ product: string; qty: number; price: number; total: number } | null>(null);
  const fabLongPress = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fabDidLongPress = useRef(false);
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const location = useLocation();
  const [permToast, setPermToast] = useState('');

  // Show toast when redirected from a protected route
  useEffect(() => {
    const msg = consumeProtectedRouteToast();
    if (msg) { setPermToast(t(msg)); setTimeout(() => setPermToast(''), 3000); }
  }, [location.pathname]);

  const handleUseInSale = (amount: number) => {
    setCalcPrefill(amount);
    setShowCalculator(false);
    setShowSalesSheet(true);
  };

  const [showOffline, setShowOffline] = useState(connStatus === 'offline');
  const [showReconnected, setShowReconnected] = useState(false);
  const prevStatus = useRef(connStatus);

  // Esc to close sales modal
  useEffect(() => {
    if (!showSalesSheet) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSalesSheet(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showSalesSheet]);

  // Ctrl+K to toggle calculator, Ctrl+Shift+N for quick note, Ctrl+Shift+A for assistant
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCalculator((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        setShowQuickNote(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        navigate('/assistant');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        navigate('/tools/calendar');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navigate]);

  // Initialize locations
  useEffect(() => {
    if (vendorId) ensureDefaultLocation(vendorId);
  }, [vendorId, ensureDefaultLocation]);

  // Auto-generate bi-weekly employee performance report (owner only)
  useEffect(() => {
    const emp = useAuthStore.getState().currentEmployee;
    if (!vendorId || !emp || emp.role !== 'owner') return;
    import('../services/performanceReport').then(({ maybeGenerateReport }) => {
      maybeGenerateReport(vendorId).catch(() => {});
    });
  }, [vendorId]);

  // Listen for Electron menu/tray "open-sale-modal" event
  useEffect(() => {
    const handler = () => setShowSalesSheet(true);
    document.addEventListener('open-sale-modal', handler);
    return () => document.removeEventListener('open-sale-modal', handler);
  }, []);

  useEffect(() => {
    if (connStatus === 'offline') {
      setShowOffline(true); setShowReconnected(false);
    } else if (prevStatus.current === 'offline') {
      setShowOffline(false); setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timer);
    } else { setShowOffline(false); }
    prevStatus.current = connStatus;
  }, [connStatus]);

  return (
    <div className="min-h-screen bg-[var(--c-bg)] md:bg-[#F0F1F3] lg:bg-[#ECEDF0]">
      {/* ── Sidebar (hidden on phone, visible on tablet+) ── */}
      <SideNav onNewSale={() => setShowSalesSheet(true)} onCalculator={() => setShowCalculator(true)} />

      {/* ── Main content column ── */}
      <div className="min-h-screen flex flex-col md:ml-[220px] lg:ml-[260px]">
        {/* Offline banners */}
        {showOffline && (
          <div className="bg-[#FEF3C7] text-[#92400E] h-9 flex items-center justify-center gap-2 text-[13px] font-medium animate-fade-in z-50">
            <RiWifiOffLine className="h-4 w-4" />
            <span className="truncate px-2">{t('offline.banner')}</span>
          </div>
        )}
        {showReconnected && (
          <div className="bg-[#D1FAE5] text-[#065F46] h-9 flex items-center justify-center gap-2 text-[13px] font-medium animate-fade-in z-50">
            <span>{t('offline.reconnected')}</span>
          </div>
        )}

        {/* Mobile top bar (phone only) */}
        <header className="md:hidden sticky top-0 z-40 bg-[var(--c-nav-bg)] backdrop-blur-md px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TalismanLogo variant="icon" size={20} />
            <span className="font-display text-lg font-extrabold text-[#2D6A4F]">Talisman</span>
            <LocationSwitcher />
          </div>
          <div className="flex items-center gap-1.5">
            <SyncIndicator />
            <span data-tour="lang-selector"><LanguageSelector /></span>
            <button type="button" onClick={toggleTheme}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-primary transition-colors"
              aria-label={isDark ? t('theme.light_mode') : t('theme.dark_mode')}>
              {isDark ? <RiSunLine className="h-4 w-4" /> : <RiMoonLine className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => useAuthStore.getState().logout()}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-[#E76F51] transition-colors"
              aria-label={t('auth.logout')}>
              <RiLogoutBoxRLine className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Global search */}
        <GlobalSearch />
        <Toast msg={permToast} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 pt-4 pb-24 md:pb-8 scrollbar-hide page-enter">
          <div className="w-full max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* ── Phone bottom navigation (hidden on tablet+) ── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40" data-tour="bottom-nav">
          <div className="h-16 bg-[var(--c-nav-bg)] backdrop-blur-[12px] shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-t-3xl px-6 flex justify-between items-center relative safe-area-pb">
            {/* Left tabs */}
            <div className="flex w-[40%] justify-between">
              <NavTab to="/" label={t('nav.home')} Icon={RiHome5Line} IconActive={RiHome5Fill} activeColor="text-[#2D6A4F]" />
              <NavTab to="/inventory" label={t('nav.inventory')} Icon={RiArchive2Line} IconActive={RiArchive2Fill} activeColor="text-[#2D6A4F]" />
            </div>

            {/* Right tabs — permission-aware for employee roles */}
            <div className="flex w-[40%] justify-between">
              {hasPermission('credit')
                ? <NavTab to="/credit" label={t('nav.credit')} Icon={RiHandCoinLine} IconActive={RiHandCoinFill} activeColor="text-[#F4A261]" />
                : <NavTab to="/history" label={t('history.title')} Icon={RiHistoryLine} IconActive={RiHistoryLine} activeColor="text-[#2D6A4F]" />
              }
              {hasPermission('reports')
                ? <NavTab to="/reports" label={t('nav.reports')} Icon={RiPieChart2Line} IconActive={RiPieChart2Fill} activeColor="text-[#3B82F6]" />
                : <NavTab to="/tools/calculator" label={t('tools.title')} Icon={RiCalculatorLine} IconActive={RiCalculatorLine} activeColor="text-[#0D9488]" />
              }
            </div>

            {/* Center FAB with long-press menu */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-5" data-tour="fab-button">
              {/* FAB popup menu */}
              {showFabMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFabMenu(false)} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 min-w-[180px] animate-fade-up">
                    <button type="button" onClick={() => { setShowFabMenu(false); setShowSalesSheet(true); }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--c-bg)] transition-colors">
                      <span className="text-lg">🛒</span>
                      <span className="text-sm font-bold text-[var(--c-text)]">{t('action.new_sale')}</span>
                    </button>
                    <button type="button" onClick={() => { setShowFabMenu(false); setShowQuickNote(true); }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[var(--c-bg)] transition-colors">
                      <span className="text-lg">📝</span>
                      <span className="text-sm font-bold text-[var(--c-text)]">{t('notes.quick')}</span>
                    </button>
                  </div>
                </>
              )}
              <button
                type="button"
                onClick={() => { if (!fabDidLongPress.current) setShowSalesSheet(true); fabDidLongPress.current = false; }}
                onTouchStart={() => {
                  fabDidLongPress.current = false;
                  fabLongPress.current = setTimeout(() => { fabDidLongPress.current = true; setShowFabMenu(true); }, 500);
                }}
                onTouchEnd={() => { if (fabLongPress.current) { clearTimeout(fabLongPress.current); fabLongPress.current = null; } }}
                onTouchMove={() => { if (fabLongPress.current) { clearTimeout(fabLongPress.current); fabLongPress.current = null; } }}
                onContextMenu={(e) => { e.preventDefault(); setShowFabMenu(true); }}
                className="w-16 h-16 bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#40916C] rounded-full shadow-xl flex items-center justify-center text-white active:scale-90 transition-transform animate-fab-pulse"
                aria-label={t('action.new_sale')}
              >
                <RiAddLine className="h-7 w-7" style={{ strokeWidth: 3 }} />
              </button>
            </div>
          </div>
        </nav>

        {/* Sales sheet: bottom sheet on phone, centered modal on tablet+ */}
        {/* Onboarding tour (first-time users only) */}
        <OnboardingTour />

        {showSalesSheet && (
          <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSalesSheet(false)} />
            {/* Phone: bottom sheet */}
            <div className="md:hidden absolute bottom-0 left-0 right-0 bg-[var(--c-bg)] rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden animate-slide-up" style={{ height: '85vh' }}>
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-hide">
                <SalesPage isSheet onComplete={(receipt) => { setShowSalesSheet(false); if (receipt) setReceiptData(receipt); }} />
              </div>
            </div>
            {/* Tablet+: centered modal */}
            <div className="hidden md:block relative bg-[var(--c-bg)] rounded-3xl shadow-2xl w-full max-w-[480px] max-h-[80vh] overflow-hidden animate-fade-up">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="overflow-y-auto px-6 pb-6 scrollbar-hide" style={{ maxHeight: 'calc(80vh - 40px)' }}>
                <SalesPage isSheet onComplete={(receipt) => { setShowSalesSheet(false); if (receipt) setReceiptData(receipt); }} />
              </div>
            </div>
          </div>
        )}

        {/* Receipt overlay — lives outside the sales sheet so it persists */}
        {receiptData && (
          <Receipt
            productName={receiptData.product}
            quantity={receiptData.qty}
            unitPrice={receiptData.price}
            total={receiptData.total}
            onClose={() => setReceiptData(null)}
          />
        )}

        {/* Floating assistant button */}
        {!showCalculator && !showSalesSheet && (
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="fixed bottom-40 right-4 md:bottom-20 md:right-6 z-30 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center text-[#8B5CF6] hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 border border-gray-100"
            aria-label={t('assistant.title')}
          >
            <RiBrainLine className="h-5 w-5" />
          </button>
        )}

        {/* Floating calculator button */}
        {!showCalculator && !showSalesSheet && (
          <button
            type="button"
            onClick={() => setShowCalculator(true)}
            className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-30 w-12 h-12 bg-white shadow-lg rounded-full flex items-center justify-center text-[#2D6A4F] hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 border border-gray-100"
            aria-label={t('calculator.open')}
          >
            <RiCalculatorLine className="h-5 w-5" />
          </button>
        )}

        {/* Calculator panel */}
        {showCalculator && (
          <div className="fixed inset-0 z-[55] md:inset-auto md:fixed md:bottom-6 md:right-6">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm md:hidden" onClick={() => setShowCalculator(false)} />
            {/* Phone: bottom sheet */}
            <div className="md:hidden absolute bottom-0 left-0 right-0 bg-[var(--c-card)] rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden animate-slide-up" style={{ height: '75vh' }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <Calculator onClose={() => setShowCalculator(false)} onUseInSale={handleUseInSale} />
            </div>
            {/* Tablet+: floating panel */}
            <div className="hidden md:flex flex-col w-[320px] bg-[var(--c-card)] rounded-3xl shadow-2xl overflow-hidden animate-fade-up border border-gray-100" style={{ maxHeight: '85vh' }}>
              <Calculator onClose={() => setShowCalculator(false)} onUseInSale={handleUseInSale} />
            </div>
          </div>
        )}

        {/* Quick Note sheet */}
        {showQuickNote && (
          <QuickNoteSheet
            vendorId={vendorId}
            t={t}
            onClose={() => setShowQuickNote(false)}
            onOpenFull={() => { setShowQuickNote(false); navigate('/notes?new=1'); }}
          />
        )}
      </div>
    </div>
  );
}

function NavTab({ to, label, Icon, IconActive, activeColor }: {
  to: string; label: string; activeColor: string;
  Icon: React.ComponentType<{ className?: string }>;
  IconActive: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink to={to} end={to === '/'}
      className={({ isActive }) => `flex flex-col items-center justify-center w-12 h-12 gap-1 transition-colors ${isActive ? activeColor : 'text-[#9CA3AF]'}`}
    >
      {({ isActive }) => (
        <>
          {isActive ? <IconActive className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
          <span className={`text-[11px] ${isActive ? 'font-bold' : 'font-normal'}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
