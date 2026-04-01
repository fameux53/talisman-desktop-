import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { Permission } from '../services/db';

interface ProtectedRouteProps {
  requiredPermission?: Permission;
}

/** Shared toast state for permission-denied redirects.
 *  Layout reads this to show a toast after redirect. */
let _pendingToast: string | null = null;
export function consumeProtectedRouteToast(): string | null {
  const msg = _pendingToast;
  _pendingToast = null;
  return msg;
}

export default function ProtectedRoute({ requiredPermission }: ProtectedRouteProps) {
  const vendor = useAuthStore((s) => s.vendor);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  // Wait for auth state to hydrate from localStorage before deciding
  if (!hydrated) return null;

  // Not authenticated — redirect to login
  if (!vendor || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Permission check — redirect to home if not authorized
  if (requiredPermission && !hasPermission(requiredPermission)) {
    _pendingToast = 'employees.no_permission';
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
