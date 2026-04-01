import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Insight } from '../services/insightEngine';

const SEVERITY_BORDER: Record<string, string> = {
  success: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  alert: 'border-l-red-500',
  info: 'border-l-blue-500',
};

export default function SmartInsights({ insights, loading }: { insights: Insight[]; loading: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-5 w-40" />
        {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="card p-8 text-center space-y-2">
        <p className="text-3xl">📊</p>
        <p className="text-sm text-[var(--c-text2)]">{t('insights.no_data')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[14px] font-bold text-[var(--c-text2)] uppercase tracking-wider flex items-center gap-2">
        📊 {t('insights.title')}
      </h2>

      {insights.map(insight => (
        <div
          key={insight.id}
          className={`card p-4 border-l-4 ${SEVERITY_BORDER[insight.severity] ?? 'border-l-blue-500'}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl mt-0.5">{insight.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[var(--c-text)]">{insight.title}</p>
              <p className="text-[13px] text-[var(--c-text2)] mt-1 whitespace-pre-line">{insight.body}</p>
              {insight.actionLabel && insight.actionRoute && (
                <button
                  type="button"
                  onClick={() => navigate(insight.actionRoute!)}
                  className="text-[12px] font-bold text-[var(--c-primary)] mt-2 flex items-center gap-1"
                >
                  {insight.actionLabel} →
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact version for dashboard — shows top 2 insights as mini cards */
export function MiniInsights({ insights }: { insights: Insight[] }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  if (insights.length === 0) return null;

  return (
    <div className="space-y-2">
      {insights.slice(0, 2).map(insight => (
        <div
          key={insight.id}
          onClick={() => navigate('/assistant')}
          className={`card p-3 border-l-4 cursor-pointer active:scale-[0.99] transition-transform ${SEVERITY_BORDER[insight.severity] ?? 'border-l-blue-500'}`}
        >
          <p className="text-[13px] text-[var(--c-text)]">
            {insight.emoji} <strong>{insight.title}</strong> — {insight.body.split('\n')[0]}
          </p>
        </div>
      ))}
      <button
        type="button"
        onClick={() => navigate('/assistant')}
        className="text-[12px] font-bold text-[var(--c-primary)]"
      >
        {t('insights.see_all')} →
      </button>
    </div>
  );
}
