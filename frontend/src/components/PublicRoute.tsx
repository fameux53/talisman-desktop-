import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/** Redirects authenticated users to home. For login/register pages. */
export default function PublicRoute() {
  const vendor = useAuthStore((s) => s.vendor);
  const hydrated = useAuthStore((s) => s.hydrated);

  // Wait for auth state to hydrate before deciding
  if (!hydrated) return null;

  if (vendor) return <Navigate to="/" replace />;
  return <Outlet />;
}
