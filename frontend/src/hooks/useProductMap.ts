import { useEffect, useState } from 'react';
import { getVendorRecords, type ProductRecord } from '../services/db';
import { useAuthStore } from '../stores/authStore';

/**
 * Loads ALL products (including inactive/archived) for the current vendor
 * into a Map for display purposes (name resolution in transactions/reports).
 */
export function useProductMap() {
  const [productMap, setProductMap] = useState<Map<string, ProductRecord>>(new Map());
  const vendorId = useAuthStore((s) => s.vendor?.id);

  useEffect(() => {
    if (!vendorId) { setProductMap(new Map()); return; }
    getVendorRecords('products', vendorId).then((products) => {
      setProductMap(new Map(products.map((p) => [p.id, p])));
    });
  }, [vendorId]);

  const resolveProduct = (productId: string | undefined) => {
    if (!productId) return null;
    return productMap.get(productId) ?? null;
  };

  return { productMap, resolveProduct };
}
