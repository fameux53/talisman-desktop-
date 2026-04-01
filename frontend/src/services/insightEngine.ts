import { getVendorRecords, type ProductRecord, type TransactionRecord, type ExpenseRecord, type GoalRecord } from './db';
import { getAllCreditEntriesSecure, getAllCustomersSecure } from './secureDb';
import { formatCurrency } from '../utils/currency';
import { getLocalToday, getWeekStart, getMonthStart, toLocalDate } from '../utils/dateRange';

export interface Insight {
  id: string;
  type: string;
  emoji: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'success' | 'alert';
  actionLabel?: string;
  actionRoute?: string;
}

type T = (key: string) => string;

function tpl(template: string, vars: Record<string, string | number>): string {
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return result;
}

export async function generateInsights(vendorId: string, locale: string, t: T): Promise<Insight[]> {
  if (!vendorId) return [];

  const [products, transactions, expenses, goals] = await Promise.all([
    getVendorRecords('products', vendorId),
    getVendorRecords('transactions', vendorId),
    getVendorRecords('expenses', vendorId),
    getVendorRecords('goals', vendorId),
  ]);

  // Credit data — may fail if encrypted store not available
  const customers = await getAllCustomersSecure(vendorId).catch(() => []);
  const creditEntries = await getAllCreditEntriesSecure(vendorId).catch(() => []);

  const activeProducts = products.filter(p => p.is_active !== false);
  const productMap = new Map(products.map(p => [p.id, p]));

  const today = getLocalToday();
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  const saleTx = transactions.filter(tx => tx.transaction_type === 'SALE');
  const thisWeekSales = saleTx.filter(tx => toLocalDate(tx.created_at) >= weekStart);
  const thisMonthSales = saleTx.filter(tx => toLocalDate(tx.created_at) >= monthStart);

  const insights: Insight[] = [];

  // ── 1: Top selling product this week ──
  const salesByProduct = new Map<string, { qty: number; revenue: number }>();
  for (const tx of thisWeekSales) {
    const pid = tx.product_id ?? '';
    const existing = salesByProduct.get(pid) ?? { qty: 0, revenue: 0 };
    existing.qty += Number(tx.quantity);
    existing.revenue += Number(tx.total_amount);
    salesByProduct.set(pid, existing);
  }

  if (salesByProduct.size > 0) {
    const sorted = [...salesByProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
    const [topId, topData] = sorted[0];
    const product = productMap.get(topId);
    if (product) {
      insights.push({
        id: 'top_product',
        type: 'top_product',
        emoji: '🏆',
        title: t('insights.top_product_title'),
        body: tpl(t('insights.top_product_body'), {
          name: product.name,
          qty: Math.round(topData.qty),
          unit: product.unit,
          revenue: formatCurrency(topData.revenue, locale),
        }),
        severity: 'success',
        actionLabel: t('insights.view_reports'),
        actionRoute: '/reports',
      });
    }
  }

  // ── 2: Low stock products ──
  const lowStockProducts = activeProducts.filter(p =>
    p.low_stock_threshold > 0 && p.stock_quantity <= p.low_stock_threshold
  );
  if (lowStockProducts.length > 0) {
    insights.push({
      id: 'low_stock',
      type: 'low_stock',
      emoji: '⚠️',
      title: tpl(t('insights.low_stock_title'), { count: lowStockProducts.length }),
      body: lowStockProducts.slice(0, 3).map(p =>
        `${p.name}: ${p.stock_quantity} ${p.unit}`
      ).join('\n') + (lowStockProducts.length > 3 ? `\n+${lowStockProducts.length - 3}...` : ''),
      severity: 'warning',
      actionLabel: t('insights.view_inventory'),
      actionRoute: '/inventory',
    });
  }

  // ── 3: Overdue credit (>14 days) ──
  const overdueCustomers = customers.filter(c => {
    if (c.balance <= 0) return false;
    const lastDate = (c as any).lastActivityDate || (c as any).last_activity_date || (c as any).createdAt || (c as any).created_at;
    if (!lastDate) return false;
    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > 14;
  }).sort((a, b) => b.balance - a.balance);

  if (overdueCustomers.length > 0) {
    const totalOverdue = overdueCustomers.reduce((s, c) => s + c.balance, 0);
    insights.push({
      id: 'overdue_credit',
      type: 'overdue_credit',
      emoji: '💳',
      title: tpl(t('insights.overdue_title'), { count: overdueCustomers.length }),
      body: overdueCustomers.slice(0, 3).map(c => {
        const lastDate = (c as any).lastActivityDate || (c as any).last_activity_date || (c as any).createdAt;
        const days = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
        return `${c.name}: ${formatCurrency(c.balance, locale)} (${days} ${t('insights.days')})`;
      }).join('\n') + `\n${t('insights.total')}: ${formatCurrency(totalOverdue, locale)}`,
      severity: 'alert',
      actionLabel: t('insights.view_credit'),
      actionRoute: '/credit',
    });
  }

  // ── 4: Low margin products ──
  const lowMarginProducts = activeProducts
    .filter(p => p.cost_price && p.cost_price > 0)
    .map(p => ({ ...p, margin: ((p.current_price - p.cost_price!) / p.current_price) * 100 }))
    .filter(p => p.margin < 15)
    .sort((a, b) => a.margin - b.margin);

  if (lowMarginProducts.length > 0) {
    insights.push({
      id: 'low_margin',
      type: 'low_margin',
      emoji: '📉',
      title: t('insights.low_margin_title'),
      body: lowMarginProducts.slice(0, 3).map(p =>
        `${p.name}: ${p.margin.toFixed(1)}% ${t('insights.margin')} (${t('insights.cost')}: ${formatCurrency(p.cost_price!, locale)} → ${t('insights.sell')}: ${formatCurrency(p.current_price, locale)})`
      ).join('\n'),
      severity: 'warning',
      actionLabel: t('insights.adjust_prices'),
      actionRoute: '/inventory',
    });
  }

  // ── 5: Best sales day ──
  if (saleTx.length >= 14) {
    const dayTotals = new Map<number, { total: number; count: number }>();
    for (const tx of saleTx) {
      if (!tx.created_at) continue; // skip transactions with missing dates
      const d = new Date(tx.created_at);
      const day = d.getDay();
      if (isNaN(day)) continue; // skip invalid dates
      const existing = dayTotals.get(day) ?? { total: 0, count: 0 };
      existing.total += Number(tx.total_amount);
      existing.count += 1;
      dayTotals.set(day, existing);
    }

    const dayNames: Record<string, string[]> = {
      ht: ['Dimanch', 'Lendi', 'Madi', 'Mèkredi', 'Jedi', 'Vandredi', 'Samdi'],
      fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
      en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    };
    const names = dayNames[locale] ?? dayNames.ht;
    const sorted = [...dayTotals.entries()].sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best && worst && best[0] !== worst[0]) {
      insights.push({
        id: 'best_day',
        type: 'best_day',
        emoji: '📅',
        title: t('insights.best_day_title'),
        body: tpl(t('insights.best_day_body'), {
          bestDay: names[best[0]],
          bestAvg: formatCurrency(Math.round(best[1].total / best[1].count), locale),
          worstDay: names[worst[0]],
          worstAvg: formatCurrency(Math.round(worst[1].total / worst[1].count), locale),
        }),
        severity: 'info',
      });
    }
  }

  // ── 6: Revenue trend (this week vs last week) ──
  const lastWeekStart = getWeekStart(1);
  const lastWeekSales = saleTx.filter(tx => {
    const d = toLocalDate(tx.created_at);
    return d >= lastWeekStart && d < weekStart;
  });
  const thisWeekRevenue = thisWeekSales.reduce((s, tx) => s + Number(tx.total_amount), 0);
  const lastWeekRevenue = lastWeekSales.reduce((s, tx) => s + Number(tx.total_amount), 0);

  if (lastWeekRevenue > 0) {
    const changePercent = Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100);
    insights.push({
      id: 'revenue_trend',
      type: 'revenue_trend',
      emoji: changePercent >= 0 ? '📈' : '📉',
      title: t('insights.revenue_trend_title'),
      body: changePercent >= 0
        ? tpl(t('insights.revenue_up'), { percent: changePercent, amount: formatCurrency(thisWeekRevenue - lastWeekRevenue, locale) })
        : tpl(t('insights.revenue_down'), { percent: Math.abs(changePercent), amount: formatCurrency(lastWeekRevenue - thisWeekRevenue, locale) }),
      severity: changePercent >= 0 ? 'success' : 'warning',
    });
  }

  // ── 7: Goal progress ──
  const dailyGoal = goals.find(g => g.type === 'daily' && g.is_active);
  if (dailyGoal) {
    const todayRevenue = saleTx
      .filter(tx => toLocalDate(tx.created_at) === today)
      .reduce((s, tx) => s + Number(tx.total_amount), 0);
    const progress = Math.min(100, Math.round((todayRevenue / dailyGoal.target_amount) * 100));

    insights.push({
      id: 'goal_status',
      type: 'goal_status',
      emoji: progress >= 100 ? '🎉' : progress >= 50 ? '🔥' : '🎯',
      title: t('insights.goal_title'),
      body: progress >= 100
        ? tpl(t('insights.goal_reached'), { amount: formatCurrency(todayRevenue, locale) })
        : tpl(t('insights.goal_progress'), { current: formatCurrency(todayRevenue, locale), target: formatCurrency(dailyGoal.target_amount, locale), percent: progress }),
      severity: progress >= 100 ? 'success' : 'info',
    });
  }

  // ── 8: Slow-moving products ──
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentSoldIds = new Set(
    saleTx.filter(tx => new Date(tx.created_at ?? 0) >= twoWeeksAgo).map(tx => tx.product_id)
  );
  const slowProducts = activeProducts.filter(p => p.stock_quantity > 0 && !recentSoldIds.has(p.id));

  if (slowProducts.length > 0) {
    insights.push({
      id: 'slow_products',
      type: 'slow_product',
      emoji: '🐌',
      title: tpl(t('insights.slow_title'), { count: slowProducts.length }),
      body: slowProducts.slice(0, 3).map(p => `${p.name}: ${p.stock_quantity} ${p.unit}`).join('\n'),
      severity: 'info',
    });
  }

  // Sort by severity priority: alert > warning > success > info
  const severityOrder: Record<string, number> = { alert: 0, warning: 1, success: 2, info: 3 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return insights;
}

// API key helpers — DEPRECATED: API key is now stored server-side.
// These stubs remain for migration: on first load the key is removed from localStorage.
export function saveApiKey(_key: string, vendorId: string): void {
  // No-op: API key is managed server-side via ANTHROPIC_API_KEY env var.
  // Clean up any legacy key left in localStorage.
  localStorage.removeItem(`tlsm_ai_key_${vendorId}`);
}

export function getApiKey(vendorId: string): string | null {
  // Migrate away: remove legacy key if present
  localStorage.removeItem(`tlsm_ai_key_${vendorId}`);
  return null;
}

// Gather business context for AI chat
export async function gatherBusinessContext(vendorId: string, locale: string): Promise<string> {
  const [products, transactions, expenses] = await Promise.all([
    getVendorRecords('products', vendorId),
    getVendorRecords('transactions', vendorId),
    getVendorRecords('expenses', vendorId),
  ]);
  const customers = await getAllCustomersSecure(vendorId).catch(() => []);

  const activeProducts = products.filter(p => p.is_active !== false);
  const saleTx = transactions.filter(tx => tx.transaction_type === 'SALE');
  const today = getLocalToday();
  const weekStart = getWeekStart();

  const todaySales = saleTx.filter(tx => toLocalDate(tx.created_at) === today);
  const weekSales = saleTx.filter(tx => toLocalDate(tx.created_at) >= weekStart);
  const todayRevenue = todaySales.reduce((s, tx) => s + Number(tx.total_amount), 0);
  const weekRevenue = weekSales.reduce((s, tx) => s + Number(tx.total_amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalCredit = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const lowStock = activeProducts.filter(p => p.low_stock_threshold > 0 && p.stock_quantity <= p.low_stock_threshold);

  const lines: string[] = [
    `Pwodwi aktif: ${activeProducts.length}`,
    `Revni jodi a: ${formatCurrency(todayRevenue, locale)} (${todaySales.length} vant)`,
    `Revni semèn sa a: ${formatCurrency(weekRevenue, locale)} (${weekSales.length} vant)`,
    `Total depans: ${formatCurrency(totalExpenses, locale)}`,
    `Kredi total deyò: ${formatCurrency(totalCredit, locale)} (${customers.filter(c => c.balance > 0).length} kliyan)`,
    `Pwodwi stòk ba: ${lowStock.length}`,
    '',
    'Pwodwi (non, pri, stòk):',
    ...activeProducts.slice(0, 15).map(p => `- ${p.name}: ${formatCurrency(p.current_price, locale)}, stòk: ${p.stock_quantity} ${p.unit}`),
    '',
    'Kliyan ak kredi:',
    ...customers.filter(c => c.balance > 0).slice(0, 10).map(c => `- ${c.name}: ${formatCurrency(c.balance, locale)}`),
  ];

  return lines.join('\n');
}

// Call Claude API via backend proxy (API key stays server-side)
interface Message { role: 'user' | 'assistant'; content: string; timestamp: string; }

export async function callClaudeAPI(_apiKey: string, userMessage: string, context: string, history: Message[]): Promise<string> {
  const { default: api } = await import('./api');

  const response = await api.post('/assistant/chat', {
    message: userMessage,
    context,
    history: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
  });

  return response.data.reply;
}
