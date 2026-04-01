import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiSendPlaneFill } from 'react-icons/ri';
import { useI18n } from '../i18n';
import { callClaudeAPI, gatherBusinessContext } from '../services/insightEngine';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_QUESTIONS = [
  { emoji: '🏆', key: 'assistant.q_top_products' },
  { emoji: '💰', key: 'assistant.q_profit' },
  { emoji: '⚠️', key: 'assistant.q_low_stock' },
  { emoji: '💳', key: 'assistant.q_credit' },
  { emoji: '📅', key: 'assistant.q_best_day' },
  { emoji: '💡', key: 'assistant.q_advice' },
];

export default function AIChat({ vendorId, apiKey }: { vendorId: string; apiKey: string }) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const online = () => setIsOffline(false);
    const offline = () => setIsOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, []);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading || isOffline) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const context = await gatherBusinessContext(vendorId, locale);
      const response = await callClaudeAPI(apiKey, text.trim(), context, messages);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      }]);
    } catch (error: any) {
      const status = error.message ?? '';
      const errorMsg = status.includes('401')
        ? t('assistant.invalid_key')
        : status.includes('429')
        ? t('assistant.rate_limited')
        : t('assistant.error');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm">🤖</div>
        <div>
          <p className="text-[14px] font-bold text-[var(--c-text)]">{t('assistant.ai_chat')}</p>
          <p className="text-[11px] text-[var(--c-text2)]">{t('assistant.ai_chat_desc')}</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="h-[400px] overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isOffline && (
          <div className="text-center py-6">
            <p className="text-[13px] text-[var(--c-text2)] mb-4">{t('assistant.ai_prompt')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => sendMessage(t(q.key))}
                  className="px-3 py-2 bg-gray-50 rounded-xl text-[12px] text-[var(--c-text)] font-medium border border-gray-100 active:scale-95 transition-transform"
                >
                  {q.emoji} {t(q.key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isOffline && messages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-3">📡</p>
            <p className="text-[13px] text-[var(--c-text2)]">{t('assistant.offline')}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[var(--c-primary)] text-white rounded-br-md'
                : 'bg-gray-50 text-[var(--c-text)] rounded-bl-md'
            }`}>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        {isOffline && (
          <p className="text-[11px] text-amber-600 mb-2 text-center">📡 {t('assistant.offline')}</p>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder={t('assistant.placeholder')}
            className="input-field flex-1"
            disabled={isLoading || isOffline}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || isOffline}
            className="w-12 h-12 gradient-primary text-white rounded-xl flex items-center justify-center active:scale-95 disabled:opacity-40 transition-transform"
          >
            <RiSendPlaneFill className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Promo card shown when no API key is set */
export function AIPromoCard() {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="rounded-3xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #111827 0%, #1F2937 100%)' }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">🤖</span>
        <div>
          <h3 className="text-[16px] font-bold">{t('assistant.promo_title')}</h3>
          <p className="text-[12px] text-white/60">{t('assistant.promo_subtitle')}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <p className="text-[13px] text-white/80 flex items-center gap-2">💬 {t('assistant.promo_feature1')}</p>
        <p className="text-[13px] text-white/80 flex items-center gap-2">📊 {t('assistant.promo_feature2')}</p>
        <p className="text-[13px] text-white/80 flex items-center gap-2">💡 {t('assistant.promo_feature3')}</p>
      </div>

      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="w-full py-3 bg-white text-gray-900 rounded-xl font-bold text-[14px] active:scale-95 transition-transform"
      >
        {t('assistant.promo_cta')}
      </button>
    </div>
  );
}
