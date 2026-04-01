import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  RiHome5Fill, RiHome5Line,
  RiArchive2Fill, RiArchive2Line,
  RiPieChart2Fill, RiPieChart2Line,
  RiHandCoinFill, RiHandCoinLine,
  RiHistoryLine, RiAddLine,
  RiLogoutBoxRLine, RiStore2Line, RiCalculatorLine,
  RiStickyNoteLine, RiStickyNoteFill,
  RiTeamLine, RiTeamFill,
  RiMapPin2Line, RiMapPin2Fill,
  RiMoneyDollarCircleLine, RiMoneyDollarCircleFill,
  RiGiftLine, RiGiftFill,
  RiMoonLine, RiSunLine,
  RiBrainLine, RiBrainFill,
  RiArrowDownSLine,
} from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import SyncIndicator from './SyncIndicator';
import LanguageSelector from './LanguageSelector';
import TalismanLogo from './TalismanLogo';

import type { Permission } from '../services/db';

interface NavItem {
  to: string;
  labelKey: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  IconActive: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  activeColor: string;
  activeBg: string;
  permission?: Permission; // if set, only show when user has this permission
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', Icon: RiHome5Line, IconActive: RiHome5Fill, activeColor: 'text-[#2D6A4F]', activeBg: 'bg-[#F0FDF4]' },
  { to: '/inventory', labelKey: 'nav.inventory', Icon: RiArchive2Line, IconActive: RiArchive2Fill, activeColor: 'text-[#2D6A4F]', activeBg: 'bg-[#F0FDF4]', permission: 'inventory' },
  { to: '/credit', labelKey: 'nav.credit', Icon: RiHandCoinLine, IconActive: RiHandCoinFill, activeColor: 'text-[#F4A261]', activeBg: 'bg-[#FFF7ED]', permission: 'credit' },
  { to: '/reports', labelKey: 'nav.reports', Icon: RiPieChart2Line, IconActive: RiPieChart2Fill, activeColor: 'text-[#3B82F6]', activeBg: 'bg-[#EFF6FF]', permission: 'reports' },
  { to: '/assistant', labelKey: 'assistant.title', Icon: RiBrainLine, IconActive: RiBrainFill, activeColor: 'text-[#8B5CF6]', activeBg: 'bg-[#F5F3FF]' },
  { to: '/expenses', labelKey: 'expenses.title', Icon: RiMoneyDollarCircleLine, IconActive: RiMoneyDollarCircleFill, activeColor: 'text-[#E76F51]', activeBg: 'bg-[#FEF2F2]', permission: 'reports' },
  { to: '/history', labelKey: 'history.title', Icon: RiHistoryLine, IconActive: RiHistoryLine, activeColor: 'text-[#2D6A4F]', activeBg: 'bg-[#F0FDF4]' },
  { to: '/notes', labelKey: 'notes.title', Icon: RiStickyNoteLine, IconActive: RiStickyNoteFill, activeColor: 'text-[#F59E0B]', activeBg: 'bg-[#FFFBEB]', permission: 'notes' },
  { to: '/suppliers', labelKey: 'suppliers.title', Icon: RiStore2Line, IconActive: RiStore2Line, activeColor: 'text-[#2D6A4F]', activeBg: 'bg-[#F0FDF4]', permission: 'suppliers' },
  { to: '/loyalty', labelKey: 'loyalty.title', Icon: RiGiftLine, IconActive: RiGiftFill, activeColor: 'text-[#F59E0B]', activeBg: 'bg-[#FFFBEB]', permission: 'settings' },
  { to: '/employees', labelKey: 'employees.title', Icon: RiTeamLine, IconActive: RiTeamFill, activeColor: 'text-[#8B5CF6]', activeBg: 'bg-[#F5F3FF]', permission: 'employees' },
  { to: '/locations', labelKey: 'locations.title', Icon: RiMapPin2Line, IconActive: RiMapPin2Fill, activeColor: 'text-[#EC4899]', activeBg: 'bg-[#FDF2F8]', permission: 'settings' },
];

export default function SideNav({ onNewSale, onCalculator }: { onNewSale: () => void; onCalculator: () => void }) {
  const { t } = useI18n();
  const location = useLocation();
  const vendor = useAuthStore((s) => s.vendor);
  const currentEmployee = useAuthStore((s) => s.currentEmployee);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';
  const isToolsActive = location.pathname.startsWith('/tools');
  const [toolsOpen, setToolsOpen] = useState(isToolsActive);

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <aside className="hidden md:flex flex-col w-[220px] lg:w-[260px] bg-white h-screen border-r border-gray-200 fixed left-0 top-0 bottom-0 z-40 overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-2.5 animate-slide-in-left">
        <TalismanLogo variant="full" size={32} className="transition-transform hover:scale-105 duration-200" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `nav-item-hover flex items-center gap-3 px-4 py-3.5 rounded-xl text-[16px] font-medium transition-all duration-200 animate-slide-in-left ${
                isActive
                  ? `${item.activeColor} ${item.activeBg} font-bold animate-nav-active shadow-sm`
                  : 'text-secondary hover:text-primary hover:bg-page hover:translate-x-1'
              }`
            }
            style={{ animationDelay: `${i * 50 + 100}ms` }}
          >
            {({ isActive }) => (
              <>
                {isActive
                  ? <item.IconActive className="h-6 w-6 flex-shrink-0 transition-transform duration-200" style={{ transform: 'scale(1.1)' }} />
                  : <item.Icon className="h-6 w-6 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                }
                <span>{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Divider + New Sale CTA */}
        <div className="pt-4 px-1 animate-bounce-in" style={{ animationDelay: '350ms' }}>
          <button
            type="button"
            onClick={onNewSale}
            className="group w-full py-3 bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#40916C] rounded-xl shadow-md flex items-center justify-center gap-2 text-white font-heading font-bold text-[14px] active:scale-[0.95] hover:shadow-lg hover:brightness-110 transition-all duration-200"
          >
            <RiAddLine className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" style={{ strokeWidth: 3 }} />
            {t('action.new_sale')}
          </button>
        </div>

        {/* Tools folder */}
        <div className="px-1 mt-2 animate-slide-in-left" style={{ animationDelay: '400ms' }}>
          <button
            type="button"
            onClick={() => setToolsOpen(!toolsOpen)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 ${
              isToolsActive ? 'text-[#0D9488] bg-cyan-50 font-bold' : 'text-secondary hover:text-primary hover:bg-page'
            }`}
          >
            <span className="text-lg">🧰</span>
            <span className="flex-1 text-left">{t('tools.title')}</span>
            <RiArrowDownSLine className={`h-4 w-4 text-[var(--c-muted)] transition-transform ${toolsOpen ? 'rotate-180' : ''}`} />
          </button>
          {toolsOpen && (
            <div className="ml-6 mt-1 space-y-0.5">
              <NavLink to="/tools/calculator"
                className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                  isActive ? 'text-[#0D9488] bg-cyan-50 font-bold' : 'text-secondary hover:text-primary hover:bg-page'
                }`}>
                <span className="text-base">🧮</span>
                <span>{t('tools.calculator')}</span>
              </NavLink>
              <NavLink to="/tools/calendar"
                className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[14px] transition-colors ${
                  isActive ? 'text-[#3B82F6] bg-blue-50 font-bold' : 'text-secondary hover:text-primary hover:bg-page'
                }`}>
                <span className="text-base">📅</span>
                <span>{t('tools.calendar')}</span>
              </NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom: vendor info + actions */}
      <div className="px-4 py-4 border-t border-page space-y-3 animate-slide-in-left" style={{ animationDelay: '400ms' }}>
        {/* Vendor info */}
        {vendor && (
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${
              !currentEmployee || currentEmployee.role === 'owner'
                ? 'gradient-primary'
                : currentEmployee.role === 'manager' ? 'bg-blue-100' : 'bg-amber-100'
            }`}>
              {!currentEmployee || currentEmployee.role === 'owner' ? '👑' : '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-primary truncate">
                {!currentEmployee || currentEmployee.role === 'owner' ? vendor.display_name : currentEmployee.name}
              </p>
              <p className="text-[11px] text-muted">
                {!currentEmployee || currentEmployee.role === 'owner'
                  ? t('employees.role_owner')
                  : `${t(`employees.role_${currentEmployee.role}`)} · ${vendor.display_name}`}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <SyncIndicator />
            <LanguageSelector />
            <button
              type="button"
              onClick={toggleTheme}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-primary hover:bg-page transition-all duration-200 active:scale-90"
              aria-label={isDark ? t('theme.light_mode') : t('theme.dark_mode')}
              title={isDark ? t('theme.light_mode') : t('theme.dark_mode')}
            >
              {isDark ? <RiSunLine className="h-4 w-4" /> : <RiMoonLine className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => useAuthStore.getState().logout()}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-[#E76F51] hover:bg-red-50 transition-all duration-200 active:scale-90"
            aria-label={t('auth.logout')}
          >
            <RiLogoutBoxRLine className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
