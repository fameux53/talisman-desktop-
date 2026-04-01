import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

export default function ToolsPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 animate-fade-up">
      <h1 className="font-heading text-2xl font-extrabold text-[var(--c-text)]">
        🧰 {t('tools.title')}
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <ToolCard to="/tools/calculator" emoji="🧮" title={t('tools.calculator')} desc={t('tools.calculator_desc')} color="bg-emerald-50" />
        <ToolCard to="/tools/calendar" emoji="📅" title={t('tools.calendar')} desc={t('tools.calendar_desc')} color="bg-blue-50" />
      </div>
    </div>
  );
}

function ToolCard({ to, emoji, title, desc, color }: {
  to: string; emoji: string; title: string; desc: string; color: string;
}) {
  return (
    <Link
      to={to}
      className={`${color} rounded-3xl p-5 flex flex-col items-center text-center gap-3 active:scale-[0.98] transition-all shadow-sm`}
    >
      <span className="text-3xl">{emoji}</span>
      <p className="text-[15px] font-bold text-[var(--c-text)]">{title}</p>
      <p className="text-[12px] text-[var(--c-text2)]">{desc}</p>
    </Link>
  );
}
