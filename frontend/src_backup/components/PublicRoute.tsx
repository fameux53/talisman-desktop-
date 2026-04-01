import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/** Redirects authenticated users to home. For login/register pages. */
export default function PublicRoute() {
  const vendor = useAuthStore((s) => s.vendor);
  if (vendor) return <Navigate to="/" replace />;
  return <Outlet />;
}
