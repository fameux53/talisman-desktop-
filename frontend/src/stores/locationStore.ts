import { create } from 'zustand';
import { getVendorRecords, putInStore, type LocationRecord } from '../services/db';

const LOCATION_KEY = 'tlsm_active_location';

interface LocationState {
  locations: LocationRecord[];
  activeLocationId: string | null; // specific location ID or 'all' for combined view
  activeLocation: LocationRecord | null; // null when 'all' is selected
  isAllLocations: boolean;

  loadLocations: (vendorId: string) => Promise<void>;
  setActiveLocation: (id: string) => void;
  ensureDefaultLocation: (vendorId: string) => Promise<void>;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  locations: [],
  activeLocationId: localStorage.getItem(LOCATION_KEY),
  activeLocation: null,
  isAllLocations: localStorage.getItem(LOCATION_KEY) === 'all',

  loadLocations: async (vendorId: string) => {
    const locs = await getVendorRecords('locations', vendorId);
    const savedId = localStorage.getItem(LOCATION_KEY);
    if (savedId === 'all') {
      set({ locations: locs, activeLocationId: 'all', activeLocation: null, isAllLocations: true });
    } else {
      const active = locs.find((l) => l.id === savedId) ?? locs.find((l) => l.is_default) ?? locs[0] ?? null;
      set({ locations: locs, activeLocationId: active?.id ?? null, activeLocation: active, isAllLocations: false });
      if (active) localStorage.setItem(LOCATION_KEY, active.id);
    }
  },

  setActiveLocation: (id: string) => {
    localStorage.setItem(LOCATION_KEY, id);
    if (id === 'all') {
      set({ activeLocationId: 'all', activeLocation: null, isAllLocations: true });
    } else {
      const { locations } = get();
      const loc = locations.find((l) => l.id === id) ?? null;
      set({ activeLocationId: id, activeLocation: loc, isAllLocations: false });
    }
  },

  ensureDefaultLocation: async (vendorId: string) => {
    const existing = await getVendorRecords('locations', vendorId);
    if (existing.length === 0) {
      const defaultLoc: LocationRecord = {
        id: crypto.randomUUID(),
        vendor_id: vendorId,
        name: 'Boutik Prensipal',
        address: null,
        phone: null,
        is_active: true,
        is_default: true,
        created_at: new Date().toISOString(),
      };
      await putInStore('locations', defaultLoc);
    }
    await get().loadLocations(vendorId);
  },
}));
