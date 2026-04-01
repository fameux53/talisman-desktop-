import { create } from 'zustand';
import api from '../services/api';
import {
  addToSyncQueue,
  getSyncQueue,
  removeSyncQueueItem,
  type SyncQueueItem,
} from '../services/db';

export type ConnStatus = 'online' | 'offline' | 'syncing';

interface SyncState {
  status: ConnStatus;
  pendingCount: number;

  setStatus: (s: ConnStatus) => void;
  enqueue: (item: Omit<SyncQueueItem, 'id' | 'createdAt'>) => Promise<void>;
  processQueue: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

function genId(): string {
  return crypto.randomUUID();
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  pendingCount: 0,

  setStatus: (status) => set({ status }),

  enqueue: async (item) => {
    const queueItem: SyncQueueItem = {
      ...item,
      id: genId(),
      createdAt: Date.now(),
    };
    await addToSyncQueue(queueItem);
    set((s) => ({ pendingCount: s.pendingCount + 1 }));
  },

  processQueue: async () => {
    if (!navigator.onLine) return;

    const queue = await getSyncQueue();
    if (queue.length === 0) return;

    set({ status: 'syncing' });

    // Group transactions for bulk endpoint
    const transactionItems = queue.filter((q) => q.endpoint === '/transactions' && q.method === 'POST');
    const otherItems = queue.filter((q) => !(q.endpoint === '/transactions' && q.method === 'POST'));

    // Bulk-sync transactions
    if (transactionItems.length > 0) {
      try {
        const bodies = transactionItems.map((q) => q.body);
        await api.post('/transactions/bulk', bodies);
        for (const item of transactionItems) {
          await removeSyncQueueItem(item.id);
        }
      } catch {
        // leave in queue for next attempt
      }
    }

    // Process remaining items one-by-one
    for (const item of otherItems) {
      try {
        if (item.method === 'POST') {
          await api.post(item.endpoint, item.body);
        } else if (item.method === 'PATCH') {
          await api.patch(item.endpoint, item.body);
        } else if (item.method === 'DELETE') {
          await api.delete(item.endpoint);
        }
        await removeSyncQueueItem(item.id);
      } catch {
        // leave in queue for next attempt
      }
    }

    await get().refreshPendingCount();
    set({ status: navigator.onLine ? 'online' : 'offline' });
  },

  refreshPendingCount: async () => {
    const queue = await getSyncQueue();
    set({ pendingCount: queue.length });
  },
}));

// ---------------------------------------------------------------------------
// Auto-detect online/offline and trigger sync
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setStatus('online');
    useSyncStore.getState().processQueue();
  });

  window.addEventListener('offline', () => {
    useSyncStore.getState().setStatus('offline');
  });
}
