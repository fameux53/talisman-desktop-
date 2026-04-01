import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
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
import { useAuthStore } from './stores/authStore';
import { useSyncStore } from './stores/syncStore';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const refreshPendingCount = useSyncStore((s) => s.refreshPendingCount);

  useEffect(() => {
    hydrate();
    refreshPendingCount();
  }, [hydrate, refreshPendingCount]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — redirect to home if already authenticated */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Protected routes — redirect to login if not authenticated */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="credit" element={<CreditPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
        </Route>

        {/* Public 404 — accessible to everyone */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
