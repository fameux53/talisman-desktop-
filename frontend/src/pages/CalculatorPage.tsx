import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import Calculator from '../components/Calculator';

export default function CalculatorPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto animate-fade-up">
      <h1 className="font-heading text-2xl font-extrabold text-[var(--c-text)] flex items-center gap-2 mb-4">
        🧮 {t('tools.calculator')}
      </h1>
      <Calculator onClose={() => navigate('/tools')} />
    </div>
  );
}
