import { useEffect, useState } from 'react';
import { getVendorRecords, type NoteRecord } from '../services/db';

/**
 * Fetch notes linked to a specific product or customer.
 * Pass exactly one of `productId` or `customerName`.
 */
export function useLinkedNotes({
  vendorId,
  productId,
  customerId,
}: {
  vendorId: string;
  productId?: string | null;
  customerId?: string | null;
}) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId || (!productId && !customerId)) {
      setNotes([]);
      return;
    }

    setLoading(true);
    getVendorRecords('notes', vendorId)
      .then((all) => {
        const filtered = all.filter((n) => {
          if (productId) return n.linked_product_id === productId;
          if (customerId) return n.linked_customer_id === customerId;
          return false;
        });
        filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        setNotes(filtered);
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [vendorId, productId, customerId]);

  return { notes, loading };
}
