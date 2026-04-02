import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import PublicRoute from './components/PublicRoute';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import SalesPage from './pages/SalesPage';
import InventoryPage from './pages/InventoryPage';
import CreditPage from './pages/CreditPage';
import ReportsPage from './pages/ReportsPage';
import NotFoundPage from './pages/NotFoundPage';
import CatalogSetupPage, { isCatalogSetupDone } from './pages/CatalogSetupPage';
import CatalogBrowsePage from './pages/CatalogBrowsePage';
import BulkImportPage from './pages/BulkImportPage';
import HistoryPage from './pages/HistoryPage';
import TipsPage from './pages/TipsPage';
import SuppliersPage from './pages/SuppliersPage';
import NotesPage from './pages/NotesPage';
import EmployeesPage from './pages/EmployeesPage';
import LocationsPage from './pages/LocationsPage';
import ExpensesPage from './pages/ExpensesPage';
import LoyaltyPage from './pages/LoyaltyPage';
import BalancePage from './pages/BalancePage';
import AssistantPage from './pages/AssistantPage';
import ForgotPinPage from './pages/ForgotPinPage';
import ToolsPage from './pages/ToolsPage';
import CalculatorPage from './pages/CalculatorPage';
import CalendarPage from './pages/CalendarPage';
import PerformanceReportPage from './pages/PerformanceReportPage';
import { useAuthStore } from './stores/authStore';
import { useSyncStore } from './stores/syncStore';
import { useThemeStore } from './stores/themeStore';
import { getVendorRecords, putInStore, type ProductRecord } from './services/db';
import api from './services/api';

function CatalogGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const vendorId = useAuthStore((s) => s.vendor?.id);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  const checkSetup = useCallback(async () => {
    if (!isAuthenticated || !vendorId) { setNeedsSetup(false); return; }
    if (isCatalogSetupDone(vendorId)) { setNeedsSetup(false); return; }

    // Check local IndexedDB first
    const local = await getVendorRecords('products', vendorId);
    if (local.length > 0) { setNeedsSetup(false); return; }

    // Local is empty — check the backend for products (returning user, new browser)
    if (navigator.onLine) {
      try {
        const { data } = await api.get<ProductRecord[]>('/products');
        if (data.length > 0) {
          // Sync server products into IndexedDB
          for (const p of data) await putInStore('products', p);
          setNeedsSetup(false);
          return;
        }
      } catch {
        // API unavailable — fall through to setup
      }
    }

    setNeedsSetup(true);
  }, [isAuthenticated, vendorId]);

  useEffect(() => { checkSetup(); }, [checkSetup]);

  if (needsSetup === null) return null; // loading
  if (needsSetup) return <CatalogSetupPage onDone={() => setNeedsSetup(false)} />;
  return <>{children}</>;
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const vendor = useAuthStore((s) => s.vendor);
  const refreshPendingCount = useSyncStore((s) => s.refreshPendingCount);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    refreshPendingCount();
  }, [hydrate, refreshPendingCount]);

  // Hydrate theme whenever vendor changes (per-vendor preference)
  useEffect(() => {
    hydrateTheme(vendor?.id);
  }, [hydrateTheme, vendor?.id]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — redirect to home if already authenticated */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-pin" element={<ForgotPinPage />} />
        </Route>

        {/* Protected routes — redirect to login if not authenticated */}
        <Route element={<ProtectedRoute />}>
          <Route path="setup" element={<CatalogSetupPage />} />
          <Route path="catalog" element={<CatalogBrowsePage />} />
          <Route path="import" element={<BulkImportPage />} />
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route index element={<HomePage />} />
            {/* Sales & inventory — accessible to all roles */}
            <Route path="sales" element={<SalesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="tips" element={<TipsPage />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="tools/calculator" element={<CalculatorPage />} />
            <Route path="tools/calendar" element={<CalendarPage />} />
            <Route path="assistant" element={<AssistantPage />} />
          </Route>
        </Route>

        {/* Routes requiring 'credit' permission (owner, manager) */}
        <Route element={<ProtectedRoute requiredPermission="credit" />}>
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route path="credit" element={<CreditPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="loyalty" element={<LoyaltyPage />} />
          </Route>
        </Route>

        {/* Routes requiring 'reports' permission (owner, manager) */}
        <Route element={<ProtectedRoute requiredPermission="reports" />}>
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/performance" element={<PerformanceReportPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
          </Route>
        </Route>

        {/* Routes requiring 'suppliers' permission (owner, manager) */}
        <Route element={<ProtectedRoute requiredPermission="suppliers" />}>
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route path="suppliers" element={<SuppliersPage />} />
          </Route>
        </Route>

        {/* Routes requiring 'notes' permission */}
        <Route element={<ProtectedRoute requiredPermission="notes" />}>
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route path="notes" element={<NotesPage />} />
          </Route>
        </Route>

        {/* Routes requiring 'employees' permission (owner only) */}
        <Route element={<ProtectedRoute requiredPermission="employees" />}>
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route path="employees" element={<EmployeesPage />} />
          </Route>
        </Route>

        {/* Routes requiring 'settings' permission (owner only) */}
        <Route element={<ProtectedRoute requiredPermission="settings" />}>
          <Route element={<CatalogGate><Layout /></CatalogGate>}>
            <Route path="locations" element={<LocationsPage />} />
          </Route>
        </Route>

        {/* Public balance check page — no auth required */}
        <Route path="/balance/:vendorId/:token" element={<BalancePage />} />

        {/* Public 404 — accessible to everyone */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
