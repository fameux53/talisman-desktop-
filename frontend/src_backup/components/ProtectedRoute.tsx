import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function ProtectedRoute() {
  const vendor = useAuthStore((s) => s.vendor);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Not authenticated — redirect to login
  if (!vendor || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
