import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { getAllFromStore, putInStore, type ProductRecord } from '../services/db';
import { useSyncStore } from '../stores/syncStore';

export function useProducts() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const status = useSyncStore((s) => s.status);

  const refresh = useCallback(async () => {
    setLoading(true);
    // Always read from IndexedDB first (offline-first)
    const cached = await getAllFromStore('products');
    setProducts(cached.filter((p) => p.is_active));
    setLoading(false);

    // Background sync from API if online
    if (navigator.onLine) {
      try {
        const { data } = await api.get<ProductRecord[]>('/products');
        for (const p of data) {
          await putInStore('products', p);
        }
        // Re-read from IndexedDB to merge local + server data
        const merged = await getAllFromStore('products');
        setProducts(merged.filter((p) => p.is_active));
      } catch {
        // API unavailable — local data is already shown
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, status]);

  return { products, loading, refresh };
}
