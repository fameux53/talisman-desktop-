import { useState, useMemo } from 'react';
import { RiHeartLine, RiHeartFill } from 'react-icons/ri';
import { useI18n, type Locale } from '../i18n';
import { BUSINESS_TIPS, TIP_CATEGORIES, type BusinessTip } from '../data/businessTips';

const SAVED_KEY = 'tlsm_saved_tips';

function getTipTitle(tip: BusinessTip, locale: Locale) {
  if (locale === 'fr') return tip.titleFR;
  if (locale === 'en') return tip.titleEN;
  return tip.titleHT;
}
function getTipBody(tip: BusinessTip, locale: Locale) {
  if (locale === 'fr') return tip.bodyFR;
  if (locale === 'en') return tip.bodyEN;
  return tip.bodyHT;
}

type FilterType = 'all' | 'favorites' | BusinessTip['category'];

export default function TipsPage() {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<FilterType>('all');
  const [savedIds, setSavedIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')); } catch { return new Set(); }
  });

  const toggleSave = (id: number) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return BUSINESS_TIPS;
    if (filter === 'favorites') return BUSINESS_TIPS.filter((tip) => savedIds.has(tip.id));
    return BUSINESS_TIPS.filter((tip) => tip.category === filter);
  }, [filter, savedIds]);

  const catLabel = (cat: string) => t(`tips.cat_${cat}`);

  const tipCounts = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set('all', BUSINESS_TIPS.length);
    counts.set('favorites', BUSINESS_TIPS.filter((tip) => savedIds.has(tip.id)).length);
    for (const tip of BUSINESS_TIPS) {
      counts.set(tip.category, (counts.get(tip.category) ?? 0) + 1);
    }
    return counts;
  }, [savedIds]);

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: t('tips.all_tips'), count: tipCounts.get('all') ?? 0 },
    { key: 'favorites', label: `❤️ ${t('tips.favorites')}`, count: tipCounts.get('favorites') ?? 0 },
    ...TIP_CATEGORIES.map((c) => ({ key: c.id as FilterType, label: `${c.emoji} ${catLabel(c.id)}`, count: tipCounts.get(c.id) ?? 0 })),
  ];

  return (
    <div className="space-y-4 animate-fade-up">
      <h1 className="font-heading text-xl font-bold text-primary">{t('tips.all_tips')}</h1>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              filter === f.key
                ? 'bg-[var(--c-primary)] text-white shadow-sm'
                : 'bg-white text-secondary border border-gray-200'
            }`}
          >
            {f.label}
            <span className={`ml-1 text-[11px] ${filter === f.key ? 'text-white/70' : 'text-muted'}`}>
              ({f.count})
            </span>
          </button>
        ))}
      </div>

      {/* Tips list */}
      {filtered.length === 0 ? (
        <div className="card p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <RiHeartLine className="h-7 w-7 text-[#E76F51] opacity-50" />
          </div>
          <h3 className="text-[16px] font-bold text-primary mb-2">
            {filter === 'favorites' ? t('empty.tips_fav_title') : t('label.no_data')}
          </h3>
          <p className="text-[14px] text-secondary max-w-[260px]">
            {filter === 'favorites' ? t('empty.tips_fav_desc') : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tip, i) => (
            <div key={tip.id} className="card p-4 space-y-2 animate-card-appear" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{tip.emoji}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-secondary`}>
                    {catLabel(tip.category)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSave(tip.id)}
                  className="p-1 flex-shrink-0 transition-transform active:scale-90"
                >
                  {savedIds.has(tip.id)
                    ? <RiHeartFill className="h-5 w-5 text-[#E76F51]" />
                    : <RiHeartLine className="h-5 w-5 text-muted" />
                  }
                </button>
              </div>
              <p className="font-heading font-bold text-[15px] text-primary">{getTipTitle(tip, locale)}</p>
              <p className="text-[14px] text-secondary leading-relaxed">{getTipBody(tip, locale)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
