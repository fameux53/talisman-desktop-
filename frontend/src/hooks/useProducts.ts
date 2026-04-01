import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { getVendorRecords, putInStore, type ProductRecord } from '../services/db';
import { useSyncStore } from '../stores/syncStore';
import { useAuthStore } from '../stores/authStore';

export function useProducts() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const status = useSyncStore((s) => s.status);
  const vendorId = useAuthStore((s) => s.vendor?.id);

  const refresh = useCallback(async () => {
    if (!vendorId) { setProducts([]); setArchivedProducts([]); setLoading(false); return; }
    setLoading(true);
    const cached = await getVendorRecords('products', vendorId);
    // Coerce numeric fields — IndexedDB may store API strings
    for (const p of cached) {
      p.current_price = Number(p.current_price);
      p.stock_quantity = Number(p.stock_quantity);
      p.low_stock_threshold = Number(p.low_stock_threshold);
      if (p.cost_price != null) p.cost_price = Number(p.cost_price);
    }
    setProducts(cached.filter((p) => p.is_active));
    setArchivedProducts(cached.filter((p) => !p.is_active));
    setLoading(false);

    if (navigator.onLine) {
      try {
        const { data } = await api.get<ProductRecord[]>('/products');
        for (const p of data) {
          // Coerce numeric fields from API strings to actual numbers
          p.current_price = Number(p.current_price);
          p.stock_quantity = Number(p.stock_quantity);
          p.low_stock_threshold = Number(p.low_stock_threshold);
          if (p.cost_price != null) p.cost_price = Number(p.cost_price);
          await putInStore('products', p);
        }
        const merged = await getVendorRecords('products', vendorId);
        for (const p of merged) {
          p.current_price = Number(p.current_price);
          p.stock_quantity = Number(p.stock_quantity);
          p.low_stock_threshold = Number(p.low_stock_threshold);
          if (p.cost_price != null) p.cost_price = Number(p.cost_price);
        }
        setProducts(merged.filter((p) => p.is_active));
        setArchivedProducts(merged.filter((p) => !p.is_active));
      } catch {
        // API unavailable — local data is already shown
      }
    }
  }, [vendorId]);

  useEffect(() => {
    refresh();
  }, [refresh, status]);

  return { products, archivedProducts, loading, refresh };
}
