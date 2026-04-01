import { useState, useEffect, useCallback } from 'react';
import { RiAddLine, RiDeleteBinLine, RiCloseLine, RiShieldCheckLine, RiUserLine, RiLockLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import {
  type EmployeeRecord, type Permission,
  ASSISTANT_PERMISSIONS,
} from '../services/db';
import { dataLayer } from '../services/dataLayer';
import Toast from '../components/Toast';

const MANAGER_PERMISSIONS: Permission[] = ['sales', 'inventory', 'inventory_edit', 'credit', 'reports', 'notes', 'suppliers'];

const ALL_PERMISSIONS: { key: Permission; labelKey: string }[] = [
  { key: 'sales', labelKey: 'employees.perm_sales' },
  { key: 'inventory', labelKey: 'employees.perm_inventory' },
  { key: 'inventory_edit', labelKey: 'employees.perm_inventory_edit' },
  { key: 'credit', labelKey: 'employees.perm_credit' },
  { key: 'reports', labelKey: 'employees.perm_reports' },
  { key: 'notes', labelKey: 'employees.perm_notes' },
  { key: 'suppliers', labelKey: 'employees.perm_suppliers' },
];

// Simple hash for local PIN storage (not cryptographic — real auth goes through backend)
async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'talisman-employee');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function EmployeesPage() {
  const { t } = useI18n();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');
  const [resetPinConfirm, setResetPinConfirm] = useState('');

  const refresh = useCallback(async () => {
    const all = await dataLayer.getEmployees(vendorId);
    all.sort((a, b) => a.name.localeCompare(b.name));
    setEmployees(all);
  }, [vendorId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Escape key closes topmost modal (delete confirm > form)
  useEffect(() => {
    if (!deleteConfirm) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDeleteConfirm(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteConfirm]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleDelete = async (id: string) => {
    await dataLayer.deleteEmployee(vendorId, id);
    setDeleteConfirm(null);
    showToast(t('employees.deleted'));
    refresh();
  };

  const handleResetPin = async () => {
    if (!resetPinId || resetPinValue.length !== 6 || resetPinValue !== resetPinConfirm) return;
    const emp = employees.find(e => e.id === resetPinId);
    if (!emp) return;
    const pinHash = await hashPin(resetPinValue);
    await dataLayer.saveEmployee({ ...emp, pin_hash: pinHash });
    setResetPinId(null);
    setResetPinValue('');
    setResetPinConfirm('');
    showToast(t('employees.pin_reset_success'));
    refresh();
  };

  const toggleActive = async (emp: EmployeeRecord) => {
    await dataLayer.saveEmployee({ ...emp, is_active: !emp.is_active });
    refresh();
  };

  return (
    <div className="space-y-4 animate-fade-up">
      <Toast msg={toast} />

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold text-primary">👥 {t('employees.title')}</h1>
        <button type="button" onClick={() => { setEditId(null); setShowForm(true); }}
          className="btn h-10 px-4 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 shadow-sm">
          <RiAddLine className="h-4 w-4" /> {t('employees.add')}
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="card p-10 text-center space-y-3">
          <p className="text-4xl">👥</p>
          <p className="text-secondary">{t('employees.empty')}</p>
          <button type="button" onClick={() => setShowForm(true)}
            className="btn h-10 px-5 rounded-xl gradient-primary text-white font-heading font-bold text-sm gap-1.5 mx-auto">
            <RiAddLine className="h-4 w-4" /> {t('employees.add')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => (
            <div key={emp.id} className="card p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center font-heading font-bold text-white text-lg flex-shrink-0 ${
                emp.role === 'manager' ? 'bg-[#3B82F6]' : 'bg-[#F4A261]'
              }`}>
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-[15px] text-primary truncate">{emp.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    emp.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t(`employees.role_${emp.role}`)}
                  </span>
                  <span className="text-[11px] text-muted">
                    {t('employees.last_login')}: {emp.last_login ? new Date(emp.last_login).toLocaleDateString() : t('employees.never')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button" onClick={() => toggleActive(emp)}
                  className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${
                    emp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                  {emp.is_active ? t('employees.active') : t('employees.inactive')}
                </button>
                <button type="button" onClick={() => { setResetPinId(emp.id); setResetPinValue(''); setResetPinConfirm(''); }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-secondary hover:bg-amber-50 hover:text-amber-600"
                  title={t('employees.reset_pin')}>
                  <RiLockLine className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { setEditId(emp.id); setShowForm(true); }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-secondary hover:bg-page">
                  <RiShieldCheckLine className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setDeleteConfirm(emp.id)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-secondary hover:bg-red-50 hover:text-[#E76F51]">
                  <RiDeleteBinLine className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <EmployeeForm
          t={t}
          vendorId={vendorId}
          editEmployee={editId ? employees.find((e) => e.id === editId) ?? null : null}
          onSave={async (emp) => {
            await dataLayer.saveEmployee(emp);
            setShowForm(false);
            setEditId(null);
            showToast(t('employees.saved'));
            refresh();
          }}
          onClose={() => { setShowForm(false); setEditId(null); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative z-10 bg-white rounded-2xl p-6 max-w-[300px] w-full mx-4 animate-fade-up shadow-2xl space-y-4">
            <p className="font-heading font-bold text-lg text-center text-primary">{t('employees.delete_confirm')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-sm text-secondary">
                {t('action.cancel')}
              </button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-11 rounded-xl bg-[#E76F51] text-white font-bold text-sm">
                {t('notes.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset PIN modal */}
      {resetPinId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setResetPinId(null)} />
          <div className="relative z-10 bg-white rounded-2xl p-6 max-w-[340px] w-full mx-4 animate-fade-up shadow-2xl space-y-4">
            <h3 className="font-heading font-bold text-lg text-center text-[var(--c-text)]">
              <RiLockLine className="inline h-5 w-5 mr-1" />
              {t('employees.reset_pin')}
            </h3>
            <p className="text-sm text-[var(--c-text2)] text-center">
              {employees.find(e => e.id === resetPinId)?.name}
            </p>
            <div>
              <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.new_pin_label')}</label>
              <input type="password" inputMode="numeric" maxLength={6} value={resetPinValue}
                onChange={e => setResetPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-xl tracking-[0.3em]" placeholder="••••••" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{t('auth.confirm_pin')}</label>
              <input type="password" inputMode="numeric" maxLength={6} value={resetPinConfirm}
                onChange={e => setResetPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-xl tracking-[0.3em]" placeholder="••••••" />
            </div>
            {resetPinValue && resetPinConfirm && resetPinValue !== resetPinConfirm && (
              <p className="text-red-500 text-xs">{t('auth.error_pin_mismatch')}</p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setResetPinId(null)}
                className="flex-1 h-11 rounded-xl border border-gray-200 font-bold text-sm text-[var(--c-text2)]">
                {t('action.cancel')}
              </button>
              <button type="button" onClick={handleResetPin}
                disabled={resetPinValue.length !== 6 || resetPinValue !== resetPinConfirm}
                className="flex-1 h-11 rounded-xl gradient-primary text-white font-bold text-sm disabled:opacity-40">
                {t('auth.change_pin')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Employee Form ── */
function EmployeeForm({ t, vendorId, editEmployee, onSave, onClose }: {
  t: (k: string) => string;
  vendorId: string;
  editEmployee: EmployeeRecord | null;
  onSave: (emp: EmployeeRecord) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(editEmployee?.name ?? '');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [role, setRole] = useState<'assistant' | 'manager'>(editEmployee?.role === 'manager' ? 'manager' : 'assistant');
  const [permissions, setPermissions] = useState<Set<Permission>>(
    new Set(editEmployee?.permissions ?? ASSISTANT_PERMISSIONS)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Update permissions when role changes
  useEffect(() => {
    if (role === 'assistant') setPermissions(new Set(ASSISTANT_PERMISSIONS));
    else setPermissions(new Set(MANAGER_PERMISSIONS));
  }, [role]);

  const togglePerm = (p: Permission) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const isValid = name.trim().length >= 2 && (editEmployee || (pin.length === 6 && pin === confirmPin));

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const pinHash = pin ? await hashPin(pin) : editEmployee!.pin_hash;
      await onSave({
        id: editEmployee?.id ?? crypto.randomUUID(),
        vendor_id: vendorId,
        name: name.trim(),
        pin_hash: pinHash,
        role,
        permissions: Array.from(permissions),
        is_active: editEmployee?.is_active ?? true,
        last_login: editEmployee?.last_login ?? null,
        created_at: editEmployee?.created_at ?? new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Talisman] Failed to save employee:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full bg-white rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden animate-slide-up md:rounded-3xl md:max-w-[480px] md:max-h-[85vh] md:animate-fade-up"
        style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-heading text-lg font-bold text-primary">
            <RiUserLine className="inline h-5 w-5 mr-1.5" />
            {editEmployee ? editEmployee.name : t('employees.add')}
          </h3>
          <button type="button" onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-secondary hover:bg-page">
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">{t('employees.name')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="input-field" placeholder="Jean" autoFocus />
          </div>

          {/* PIN */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t('employees.pin')} {editEmployee && <span className="text-muted">(optional)</span>}
              </label>
              <input type="password" inputMode="numeric" value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-xl tracking-[0.3em]" placeholder="••••••" maxLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">{t('employees.pin_confirm')}</label>
              <input type="password" inputMode="numeric" value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input-field text-center text-xl tracking-[0.3em]" placeholder="••••••" maxLength={6} />
            </div>
          </div>
          {pin && confirmPin && pin !== confirmPin && (
            <p className="text-red-500 text-xs -mt-2">{t('auth.error_pin_mismatch')}</p>
          )}

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">{t('employees.role')}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRole('assistant')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  role === 'assistant' ? 'border-[var(--c-primary)] bg-emerald-50' : 'border-gray-200 bg-page'
                }`}>
                <p className="font-heading font-bold text-sm text-primary">{t('employees.role_assistant')}</p>
                <p className="text-[11px] text-secondary mt-0.5">{t('employees.perm_sales')} + {t('employees.perm_inventory')}</p>
              </button>
              <button type="button" onClick={() => setRole('manager')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  role === 'manager' ? 'border-[#3B82F6] bg-blue-50' : 'border-gray-200 bg-page'
                }`}>
                <p className="font-heading font-bold text-sm text-primary">{t('employees.role_manager')}</p>
                <p className="text-[11px] text-secondary mt-0.5">{t('notes.all_options')}</p>
              </button>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">{t('employees.permissions')}</label>
            <div className="space-y-1.5">
              {ALL_PERMISSIONS.map(({ key, labelKey }) => (
                <label key={key} className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={permissions.has(key)}
                    onChange={() => togglePerm(key)}
                    className="w-5 h-5 rounded border-gray-300 text-[var(--c-primary)] focus:ring-[var(--c-primary)]" />
                  <span className="text-sm text-primary">{t(labelKey)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="px-5 py-4 border-t border-border">
          <button type="button" onClick={handleSubmit} disabled={!isValid || saving}
            className="btn w-full h-12 rounded-xl gradient-primary text-white font-heading font-bold text-base shadow-md disabled:opacity-40">
            {saving ? t('label.loading') : editEmployee ? t('action.save') : t('employees.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
