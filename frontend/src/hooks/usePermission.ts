import { useAuthStore } from '../stores/authStore';
import type { Permission } from '../services/db';

export function usePermission(permission: Permission): boolean {
  return useAuthStore((s) => s.hasPermission(permission));
}

export function useIsOwner(): boolean {
  return useAuthStore((s) => s.currentEmployee?.role === 'owner') ?? false;
}
