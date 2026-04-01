import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/authStore';

export default function NotFoundPage() {
  const { t } = useI18n();
  const vendor = useAuthStore((s) => s.vendor);

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <p className="font-heading text-7xl font-extrabold text-[var(--c-primary)] opacity-20 mb-4">404</p>
        <p className="text-lg text-[var(--c-text2)] mb-6">{t('error.404')}</p>
        {vendor ? (
          <Link to="/" className="btn h-12 px-8 rounded-xl gradient-primary text-white font-heading font-bold shadow-md inline-flex">
            {t('error.404_back')}
          </Link>
        ) : (
          <Link to="/login" className="btn h-12 px-8 rounded-xl gradient-primary text-white font-heading font-bold shadow-md inline-flex">
            {t('error.go_to_login')}
          </Link>
        )}
      </div>
    </div>
  );
}
