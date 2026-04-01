import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import LanguageSelector from '../components/LanguageSelector';
import TalismanLogo from '../components/TalismanLogo';

interface BalanceEntry {
  type: 'CREDIT_GIVEN' | 'PAYMENT_RECEIVED';
  amount: number;
  date: string;
  description?: string;
}

interface BalanceData {
  customer_name: string;
  vendor_name: string;
  balance: number;
  currency: string;
  entries: BalanceEntry[];
  updated_at: string;
}

export default function BalancePage() {
  const { vendorId, token } = useParams<{ vendorId: string; token: string }>();
  const { t, locale, setLocale } = useI18n();
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Detect browser language on first visit (customer doesn't have the app)
  useEffect(() => {
    if (localStorage.getItem('talisman_locale')) return; // already set by user
    const lang = navigator.language?.slice(0, 2).toLowerCase();
    if (lang === 'fr') setLocale('fr');
    else if (lang === 'en') setLocale('en');
    // Default stays 'ht' (Creole)
  }, [setLocale]);

  useEffect(() => {
    if (!vendorId || !token) { setError(true); setLoading(false); return; }

    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
    fetch(`${apiUrl}/credit/balance/${vendorId}/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [vendorId, token]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, {
      day: 'numeric', month: 'short',
    });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === 'ht' ? 'fr-HT' : locale, {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-[var(--c-bg)] flex flex-col items-center">
      <div className="absolute top-4 right-4 z-10"><LanguageSelector /></div>

      {/* Header */}
      <div className="w-full gradient-primary px-5 pt-12 pb-16 text-white text-center">
        <TalismanLogo variant="icon" size={40} className="mb-2" />
        <h1 className="font-heading text-2xl font-extrabold">Talisman</h1>
        <p className="text-white/70 text-sm mt-1.5">{t('balance.subtitle')}</p>
      </div>

      <div className="w-full max-w-[420px] px-5 -mt-8">
        {loading ? (
          <div className="card p-10 text-center">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-[var(--c-primary)] rounded-full animate-spin mx-auto" />
            <p className="text-sm text-[var(--c-text2)] mt-4">{t('label.loading')}</p>
          </div>
        ) : error || !data ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-5xl">🔒</p>
            <p className="font-heading font-bold text-lg text-[var(--c-text)]">{t('balance.not_found')}</p>
            <p className="text-sm text-[var(--c-text2)] leading-relaxed">{t('balance.not_found_desc')}</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-up">
            {/* Main balance card */}
            <div className="card p-6 space-y-4">
              {/* Customer avatar + info */}
              <div className="text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-[#F4A261] text-white flex items-center justify-center font-heading text-3xl font-bold mb-3 shadow-md">
                  {data.customer_name.charAt(0)}
                </div>
                <p className="font-heading text-xl font-bold text-[var(--c-text)]">{data.customer_name}</p>
                <p className="text-sm text-[var(--c-text2)] mt-0.5">
                  {t('balance.vendor_label')}: <span className="font-semibold text-[var(--c-text)]">{data.vendor_name}</span>
                </p>
              </div>

              {/* Balance amount */}
              <div className={`rounded-2xl p-5 text-center ${
                data.balance > 0 ? 'bg-[#FFF7ED]' : 'bg-[#F0FDF4]'
              }`}>
                <p className="text-xs uppercase tracking-wider font-bold text-[var(--c-text2)] mb-1">
                  {t('trust.current_balance')}
                </p>
                <p className={`font-heading text-[42px] font-extrabold leading-none ${
                  data.balance > 0 ? 'text-[#F4A261]' : 'text-emerald-600'
                }`}>
                  {data.balance.toLocaleString()} <span className="text-[20px]">{data.currency}</span>
                </p>
                <p className={`text-sm mt-2 font-medium ${data.balance > 0 ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                  {data.balance > 0 ? t('balance.outstanding') : t('balance.clear')}
                </p>
              </div>
            </div>

            {/* Transaction history */}
            {data.entries.length > 0 && (
              <div className="card p-5">
                <h3 className="font-heading font-bold text-base text-[var(--c-text)] mb-3">{t('balance.recent_entries')}</h3>
                <div className="relative pl-5">
                  <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-gray-200" />
                  {data.entries.map((entry, i) => {
                    const isCredit = entry.type === 'CREDIT_GIVEN';
                    return (
                      <div key={i} className="relative pb-3 last:pb-0">
                        <span className={`absolute left-0 top-1.5 h-[14px] w-[14px] rounded-full border-2 border-white ${
                          isCredit ? 'bg-[#F4A261]' : 'bg-emerald-500'
                        }`} style={{ marginLeft: '-7px', left: '9px' }} />
                        <div className="ml-5 flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-medium ${isCredit ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                              {isCredit ? t('balance.credit_entry') : t('balance.payment_entry')}
                            </p>
                            <p className="text-[11px] text-[var(--c-muted)]">{formatDate(entry.date)}</p>
                          </div>
                          <p className={`font-heading font-bold text-[15px] ${isCredit ? 'text-[#F4A261]' : 'text-emerald-600'}`}>
                            {isCredit ? '+' : '-'}{entry.amount.toLocaleString()} {data.currency}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Updated at + footer */}
            <div className="text-center space-y-2 pb-8">
              <p className="text-xs text-[var(--c-muted)]">
                {t('balance.updated_at')}: {formatDateTime(data.updated_at)}
              </p>
              <p className="text-xs text-[var(--c-muted)] flex items-center justify-center gap-1">
                {t('balance.powered_by')} Talisman
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
