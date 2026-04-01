import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { getAllFromStore, type TransactionRecord } from '../services/db';

export function useTodaySales() {
  const [sales, setSales] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    // Start with local offline transactions
    const local = await getAllFromStore('transactions');
    const localToday = local.filter(
      (t) => t.transaction_type === 'SALE' && t.recorded_offline,
    );

    try {
      if (navigator.onLine) {
        const { data } = await api.get<TransactionRecord[]>('/transactions', {
          params: { type: 'SALE', date_from: today, limit: 100 },
        });
        // Merge: API data + unsyncedlocal (avoid dupes by id)
        const ids = new Set(data.map((d) => d.id));
        const merged = [...data, ...localToday.filter((l) => !ids.has(l.id))];
        setSales(merged);
      } else {
        setSales(localToday);
      }
    } catch {
      setSales(localToday);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { sales, loading, refresh };
}
