import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { getVendorRecords } from '../services/db';
import { useAuthStore } from '../stores/authStore';
import CatalogSetupPage from './CatalogSetupPage';

export default function CatalogBrowsePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const vendorId = useAuthStore((s) => s.vendor?.id) ?? '';
  const [existingNames, setExistingNames] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    getVendorRecords('products', vendorId).then((products) => {
      const names = new Set(
        products.flatMap((p) => [
          p.name.toLowerCase(),
          ...(p.name_creole ? [p.name_creole.toLowerCase()] : []),
        ])
      );
      setExistingNames(names);
    });
  }, []);

  if (existingNames === null) return null;

  return (
    <div>
      {/* Back button overlay */}
      <div className="fixed top-3 left-3 z-50">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-sm font-medium text-[var(--c-primary)] shadow-sm"
        >
          <RiArrowLeftLine className="h-4 w-4" />
          {t('action.back')}
        </button>
      </div>
      <CatalogSetupPage
        existingProductNames={existingNames}
        onDone={() => navigate('/inventory', { replace: true })}
      />
    </div>
  );
}
