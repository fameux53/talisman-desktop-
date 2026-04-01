import { useState, useEffect, useCallback } from 'react';
import { RiAddLine, RiDeleteBinLine, RiCloseLine, RiMapPinLine, RiStarLine, RiStarFill } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useLocationStore } from '../stores/locationStore';
import { getVendorRecords, putInStore, deleteFromStore, type LocationRecord } from '../services/db';
import Toast from '../components/Toast';

export default function LocationsPage() {
  const { t } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const { loadLocations } = useLocationStore();
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editLoc, setEditLoc] = useState<LocationRecord | null>(null);
  const [toast, setToast] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await getVendorRecords('locations', vendorId);
    all.sort((a, b) => (a.is_default ? -1 : b.is_default ? 1 : a.name.localeCompare(b.name)));
    setLocations(all);
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Escape key closes topmost modal (delete confirm > form)
  useEffect(() => {
    if (!deleteConfirm && !showForm) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirm) setDeleteConfirm(null);
        else if (showForm) setShowForm(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteConfirm, showForm]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleSave = async (loc: LocationRecord) => {
    // If setting as default, unset previous default
    if (loc.is_default) {
      for (const existing of locations) {
        if (existing.id !== loc.id && existing.is_default) {
          await putInStore('locations', { ...existing, is_default: false });
        }
      }
    }
    await putInStore('locations', loc);
    setShowForm(false);
    setEditLoc(null);
    showToast(t('locations.saved'));
    refresh();
    loadLocations(vendorId);
  };

  const handleDelete = async (id: string) => {
    const loc = locations.find((l) => l.id === id);
    if (loc?.is_default) { showToast(t('locations.cant_delete_default')); setDeleteConfirm(null); return; }
    await deleteFromStore('locations', id);
    setDeleteConfirm(null);
    showToast(t('locations.deleted'));
    refresh();
    loadLocations(vendorId);
  };

  const setDefault = async (id: string) => {
    for (const loc of locations) {
      await putInStore('locations', { ...loc, is_default: loc.id === id });
    }
    refresh();
    loadLocations(vendorId);
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold text-primary">📍 {t('locations.title')}</h1>
        <button type="button" onClick={() => { setEditLoc(null); setShowForm(true); }}
          className="btn h-10 px-4 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 shadow-sm">
          <RiAddLine className="h-4 w-4" /> {t('locations.add')}
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="text-4xl">📍</p>
          <p className="text-secondary">{t('locations.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div key={loc.id} className="card p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
                loc.is_default ? 'bg-[#F0FDF4] text-[var(--c-primary)]' : 'bg-gray-100 text-secondary'
              }`}>
                <RiMapPinLine className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-heading font-bold text-[15px] text-primary truncate">{loc.name}</p>
                  {loc.is_default && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{t('locations.default')}</span>
                  )}
                </div>
                {loc.address && <p className="text-[12px] text-muted truncate">{loc.address}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button type="button" onClick={() => setDefault(loc.id)} title={t('locations.set_default')}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-secondary hover:bg-page">
                  {loc.is_default ? <RiStarFill className="h-4 w-4 text-amber-400" /> : <RiStarLine className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => { setEditLoc(loc); setShowForm(true); }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-secondary hover:bg-page">
                  <RiMapPinLine className="h-4 w-4" />
                </button>
                {!loc.is_default && (
                  <button type="button" onClick={() => setDeleteConfirm(loc.id)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-secondary hover:bg-red-50 hover:text-[#E76F51]">
                    <RiDeleteBinLine className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Location form */}
      {showForm && (
        <div className="fixed inset-0 z-50 md:flex md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-2xl animate-slide-up md:relative md:z-10 md:rounded-3xl md:w-full md:max-w-[420px] md:max-h-[90vh] md:overflow-y-auto md:animate-fade-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1 md:hidden"><div className="w-10 h-1 bg-gray-300 rounded-full" /></div>
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className="font-heading text-lg font-bold text-primary">{editLoc ? editLoc.name : t('locations.add')}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 w-8 rounded-full flex items-center justify-center text-secondary hover:bg-page">
                <RiCloseLine className="h-5 w-5" />
              </button>
            </div>
            <LocationForm
              t={t}
              vendorId={vendorId}
              editLocation={editLoc}
              onSave={handleSave}
            />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-[300px] w-full mx-4 animate-fade-up shadow-2xl space-y-4">
            <p className="font-heading font-bold text-lg text-center text-primary">{t('locations.delete_confirm')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-sm text-secondary">{t('action.cancel')}</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-11 rounded-xl bg-[#E76F51] text-white font-bold text-sm">{t('notes.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationForm({ t, vendorId, editLocation, onSave }: {
  t: (k: string) => string; vendorId: string; editLocation: LocationRecord | null;
  onSave: (loc: LocationRecord) => void;
}) {
  const [name, setName] = useState(editLocation?.name ?? '');
  const [address, setAddress] = useState(editLocation?.address ?? '');
  const [phone, setPhone] = useState(editLocation?.phone ?? '');

  return (
    <div className="px-5 pb-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">{t('locations.name')}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="input-field" placeholder="Boutik Mache Salomon" autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">{t('locations.address')}</label>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
          className="input-field" placeholder="Croix-des-Bossales, Port-au-Prince" />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">{t('auth.phone')}</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="input-field" placeholder="+509 ..." />
      </div>
      <button type="button" disabled={!name.trim()}
        onClick={() => onSave({
          id: editLocation?.id ?? crypto.randomUUID(),
          vendor_id: vendorId,
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          is_active: editLocation?.is_active ?? true,
          is_default: editLocation?.is_default ?? false,
          created_at: editLocation?.created_at ?? new Date().toISOString(),
        })}
        className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md disabled:opacity-40">
        {t('action.save')}
      </button>
    </div>
  );
}
