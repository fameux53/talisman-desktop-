import { useState, useEffect, useCallback } from 'react';
import { RiDeleteBack2Line, RiCloseLine, RiFileCopyLine, RiShoppingCart2Line, RiCheckLine } from 'react-icons/ri';
import { useI18n } from '../i18n';

type Operator = '+' | '-' | '×' | '÷' | null;
type QuickMode = 'standard' | 'change' | 'margin' | 'bulk';

const OP_SYMBOLS: Record<string, string> = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

interface CalculatorProps {
  onClose: () => void;
  onUseInSale?: (amount: number) => void;
}

export default function Calculator({ onClose, onUseInSale }: CalculatorProps) {
  const { t } = useI18n();
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<QuickMode>('standard');

  // Quick mode state
  const [qInput1, setQInput1] = useState('');
  const [qInput2, setQInput2] = useState('');

  const inputDigit = useCallback((digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay((d) => (d === '0' ? digit : d + digit));
    }
  }, [waitingForOperand]);

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) setDisplay((d) => d + '.');
  }, [waitingForOperand, display]);

  const calculate = useCallback((a: number, b: number, op: Operator): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  }, []);

  const handleOperator = useCallback((nextOp: Operator) => {
    const current = parseFloat(display);
    if (prev !== null && !waitingForOperand) {
      const result = calculate(prev, current, operator);
      const rounded = Math.round(result * 100) / 100;
      setDisplay(String(rounded));
      setPrev(rounded);
      setExpression(`${rounded} ${OP_SYMBOLS[nextOp!]}`);
    } else {
      setPrev(current);
      setExpression(`${current.toLocaleString()} ${OP_SYMBOLS[nextOp!]}`);
    }
    setOperator(nextOp);
    setWaitingForOperand(true);
  }, [display, prev, operator, waitingForOperand, calculate]);

  const handleEquals = useCallback(() => {
    if (prev === null || operator === null) return;
    const current = parseFloat(display);
    const result = calculate(prev, current, operator);
    const rounded = Math.round(result * 100) / 100;
    const fullExpr = `${prev.toLocaleString()} ${OP_SYMBOLS[operator]} ${current.toLocaleString()} = ${rounded.toLocaleString()}`;
    setHistory((h) => [fullExpr, ...h.slice(0, 9)]);
    setExpression(fullExpr);
    setDisplay(String(rounded));
    setPrev(null);
    setOperator(null);
    setWaitingForOperand(true);
  }, [prev, operator, display, calculate]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setPrev(null);
    setOperator(null);
    setWaitingForOperand(false);
    setExpression('');
  }, []);

  const handleBackspace = useCallback(() => {
    if (waitingForOperand) return;
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : '0'));
  }, [waitingForOperand]);

  const handlePercent = useCallback(() => {
    const current = parseFloat(display);
    if (prev !== null) {
      const result = Math.round(prev * (current / 100) * 100) / 100;
      setDisplay(String(result));
    } else {
      setDisplay(String(Math.round((current / 100) * 100) / 100));
    }
  }, [display, prev]);

  const copyResult = useCallback(async () => {
    await navigator.clipboard.writeText(parseFloat(display).toLocaleString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [display]);

  const useInSale = useCallback(() => {
    if (onUseInSale) {
      onUseInSale(parseFloat(display));
      onClose();
    }
  }, [display, onUseInSale, onClose]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode !== 'standard') return;
      if (e.key >= '0' && e.key <= '9') inputDigit(e.key);
      else if (e.key === '.') inputDecimal();
      else if (e.key === '+') handleOperator('+');
      else if (e.key === '-') handleOperator('-');
      else if (e.key === '*') handleOperator('×');
      else if (e.key === '/') { e.preventDefault(); handleOperator('÷'); }
      else if (e.key === 'Enter' || e.key === '=') handleEquals();
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Escape') onClose();
      else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) handleClear();
      else if (e.key === '%') handlePercent();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, inputDigit, inputDecimal, handleOperator, handleEquals, handleBackspace, handleClear, handlePercent, onClose]);

  // Format display
  const formattedDisplay = (() => {
    const num = parseFloat(display);
    if (isNaN(num) || display.endsWith('.') || display === '0.') return display;
    if (display.includes('.')) {
      const [int, dec] = display.split('.');
      return Number(int).toLocaleString() + '.' + dec;
    }
    return num.toLocaleString();
  })();

  const activeOp = !waitingForOperand ? null : operator;

  // Quick mode calculations
  const quickResult = (() => {
    const a = parseFloat(qInput1) || 0;
    const b = parseFloat(qInput2) || 0;
    if (mode === 'change') return { result: Math.max(0, b - a), label: t('calculator.change_result') };
    if (mode === 'margin') {
      const profit = b - a;
      const pct = a > 0 ? Math.round((profit / a) * 1000) / 10 : 0;
      return { result: profit, label: `${t('calculator.margin_profit')}: ${profit.toLocaleString()} G (${pct}%)` };
    }
    if (mode === 'bulk') return { result: a * b, label: t('calculator.bulk_total') };
    return { result: 0, label: '' };
  })();

  // Button styles
  const btnBase = 'flex items-center justify-center rounded-2xl font-heading font-bold text-lg transition-all duration-100 active:scale-[0.93] select-none';
  const btnNum = `${btnBase} bg-[var(--c-card)] text-[var(--c-text)] hover:bg-[var(--c-bg)] h-[52px]`;
  const btnOp = (op: Operator) => `${btnBase} h-[52px] ${activeOp === op ? 'bg-[#2D6A4F] text-white' : 'bg-[#E8F5E9] text-[#2D6A4F] hover:bg-[#C8E6C9]'}`;
  const btnFunc = `${btnBase} bg-[var(--c-bg)] text-[var(--c-text2)] hover:bg-gray-200 h-[52px]`;

  // Quick mode UI
  if (mode !== 'standard') {
    const labels: Record<QuickMode, [string, string]> = {
      change: [t('calculator.change_total'), t('calculator.change_given')],
      margin: [t('calculator.margin_cost'), t('calculator.margin_sell')],
      bulk: [t('calculator.bulk_unit'), t('calculator.bulk_qty')],
      standard: ['', ''],
    };
    const [label1, label2] = labels[mode];
    const emoji = mode === 'change' ? '💰' : mode === 'margin' ? '📊' : '📦';

    return (
      <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-heading text-lg font-bold text-[var(--c-text)]">{emoji} {t(`calculator.${mode}`)}</h3>
          <button type="button" onClick={() => { setMode('standard'); setQInput1(''); setQInput2(''); }}
            className="w-8 h-8 rounded-full bg-[var(--c-bg)] flex items-center justify-center text-[var(--c-text2)] active:scale-95">
            <RiCloseLine className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 space-y-3 flex-1">
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{label1}</label>
            <input type="number" inputMode="decimal" value={qInput1} onChange={(e) => setQInput1(e.target.value)}
              className="input-field text-right text-xl font-heading font-bold" placeholder="0" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--c-text2)] mb-1">{label2}</label>
            <input type="number" inputMode="decimal" value={qInput2} onChange={(e) => setQInput2(e.target.value)}
              className="input-field text-right text-xl font-heading font-bold" placeholder="0" />
          </div>
          <div className="bg-[var(--c-bg)] rounded-2xl px-5 py-4 text-right mt-4">
            <p className="text-sm text-[var(--c-text2)]">{quickResult.label}</p>
            <p className="font-heading text-3xl font-extrabold text-[#2D6A4F]">{quickResult.result.toLocaleString()} G</p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <button type="button" onClick={() => { setDisplay(String(quickResult.result)); setMode('standard'); setQInput1(''); setQInput2(''); }}
            className="w-full py-3 gradient-primary text-white rounded-xl font-heading font-bold text-sm active:scale-95">
            {t('calculator.use_result')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <h3 className="font-heading text-base font-bold text-[var(--c-text)]">🧮 {t('calculator.title')}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--c-text2)] hidden md:inline">Ctrl+K</span>
          <button type="button" onClick={onClose}
            className="w-7 h-7 rounded-full bg-[var(--c-bg)] flex items-center justify-center text-[var(--c-text2)] active:scale-95">
            <RiCloseLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick mode chips */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {(['change', 'margin', 'bulk'] as QuickMode[]).map((m) => {
          const emojis = { change: '💰', margin: '📊', bulk: '📦' };
          return (
            <button key={m} type="button" onClick={() => setMode(m)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-[var(--c-bg)] text-[12px] font-medium text-[var(--c-text2)] hover:bg-[#E8F5E9] hover:text-[#2D6A4F] transition-colors whitespace-nowrap">
              {emojis[m]} {t(`calculator.${m}`)}
            </button>
          );
        })}
      </div>

      {/* Display */}
      <div className="px-4 py-2">
        <div className="bg-[var(--c-bg)] rounded-2xl px-4 py-3 text-right">
          <p className="text-[13px] text-[var(--c-text2)] h-5 truncate">{expression || '\u00A0'}</p>
          <p className="font-heading text-[32px] font-extrabold text-[var(--c-text)] truncate leading-tight">{formattedDisplay}</p>
          <p className="text-[11px] text-[var(--c-text2)] mt-0.5">HTG</p>
        </div>
      </div>

      {/* Button grid */}
      <div className="px-3 grid grid-cols-4 gap-[6px]">
        <button type="button" className={btnFunc} onClick={handleClear}>{t('calculator.clear')}</button>
        <button type="button" className={btnFunc} onClick={handleBackspace}><RiDeleteBack2Line className="h-5 w-5" /></button>
        <button type="button" className={btnFunc} onClick={handlePercent}>%</button>
        <button type="button" className={btnOp('÷')} onClick={() => handleOperator('÷')}>÷</button>

        <button type="button" className={btnNum} onClick={() => inputDigit('7')}>7</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('8')}>8</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('9')}>9</button>
        <button type="button" className={btnOp('×')} onClick={() => handleOperator('×')}>×</button>

        <button type="button" className={btnNum} onClick={() => inputDigit('4')}>4</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('5')}>5</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('6')}>6</button>
        <button type="button" className={btnOp('-')} onClick={() => handleOperator('-')}>−</button>

        <button type="button" className={btnNum} onClick={() => inputDigit('1')}>1</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('2')}>2</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('3')}>3</button>
        <button type="button" className={btnOp('+')} onClick={() => handleOperator('+')}>+</button>

        <button type="button" className={btnNum} onClick={() => { inputDigit('0'); inputDigit('0'); }}>00</button>
        <button type="button" className={btnNum} onClick={() => inputDigit('0')}>0</button>
        <button type="button" className={btnNum} onClick={inputDecimal}>.</button>
        <button type="button" className={`${btnBase} h-[52px] gradient-primary text-white shadow-md`} onClick={handleEquals}>=</button>
      </div>

      {/* Action buttons */}
      <div className="px-3 pt-2 pb-3 flex gap-2">
        <button type="button" onClick={copyResult}
          className="flex-1 py-2.5 bg-[var(--c-bg)] rounded-xl text-[13px] font-bold text-[var(--c-text)] flex items-center justify-center gap-1.5 active:scale-95 transition-all">
          {copied ? <RiCheckLine className="h-4 w-4 text-emerald-500" /> : <RiFileCopyLine className="h-4 w-4" />}
          {copied ? t('calculator.copied') : t('calculator.copy')}
        </button>
        {onUseInSale && (
          <button type="button" onClick={useInSale}
            className="flex-1 py-2.5 gradient-primary rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm">
            <RiShoppingCart2Line className="h-4 w-4" />
            {t('calculator.use_in_sale')}
          </button>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="px-4 pb-3 border-t border-[var(--c-bg)] pt-2">
          <p className="text-[10px] text-[var(--c-text2)] font-bold uppercase tracking-wider mb-1">{t('calculator.history')}</p>
          <div className="space-y-0.5 max-h-[60px] overflow-y-auto scrollbar-hide">
            {history.map((entry, i) => (
              <p key={i} className="text-[11px] text-[var(--c-text2)] truncate">{entry}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
