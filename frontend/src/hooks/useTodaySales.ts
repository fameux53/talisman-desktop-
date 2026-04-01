import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { getVendorRecords, type TransactionRecord } from '../services/db';
import { getLocalToday, toLocalDate } from '../utils/dateRange';
import { useAuthStore } from '../stores/authStore';

export function useTodaySales() {
  const [sales, setSales] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const vendorId = useAuthStore((s) => s.vendor?.id);

  const refresh = useCallback(async () => {
    if (!vendorId) { setSales([]); setLoading(false); return; }
    setLoading(true);
    const today = getLocalToday();

    const local = await getVendorRecords('transactions', vendorId);
    const localToday = local.filter(
      (t) => t.transaction_type === 'SALE' && toLocalDate(t.created_at) === today,
    );

    try {
      if (navigator.onLine) {
        const { data } = await api.get<TransactionRecord[]>('/transactions', {
          params: { type: 'SALE', date_from: today, limit: 100 },
        });
        const apiToday = data.filter((t) => toLocalDate(t.created_at) === today);
        const ids = new Set(apiToday.map((d) => d.id));
        const merged = [...apiToday, ...localToday.filter((l) => !ids.has(l.id))];
        setSales(merged);
      } else {
        setSales(localToday);
      }
    } catch {
      setSales(localToday);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sales, loading, refresh };
}
