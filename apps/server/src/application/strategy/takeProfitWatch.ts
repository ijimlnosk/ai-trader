import { seoulOrderDate } from '../../domain/orders.ts';
import { parseRiskDecimal } from '../../domain/risk/decimal.ts';
import { krxSessionStatus } from '../../domain/scheduler/krxCalendar.ts';
import { gainBps, TAKE_PROFIT_RULES, type TakeProfitRule } from '../../domain/strategy/takeProfit.ts';
import type { MarketBroker } from '../market.ts';
import type { AccountBroker } from '../portfolio.ts';

const WATCH_START_MINUTE = 9 * 60 + 5;
const WATCH_END_MINUTE = 15 * 60 + 20;
const MAX_QUOTE_AGE_MS = 10_000;

export interface IntradaySignal {
  symbol: string;
  sessionDate: string;
  rule: TakeProfitRule;
  /** KRW per share from the broker's position, the quote price that crossed, and whole shares held. */
  averagePrice: string;
  price: string;
  quantity: string;
  gainBps: number;
  quoteAt: string;
  detectedAt: string;
}

export interface IntradaySignalRepository {
  /** Insert-only; false when this symbol, session and rule were already recorded. */
  record(signal: IntradaySignal): Promise<boolean>;
}

/**
 * Order-free dry run of take-profit thresholds: during the session, records the first time each held position's
 * fresh quote is at least 5%, 10% and 30% above its average purchase price (one record per threshold). It never creates a
 * proposal or order. Failed or stale reads are skipped and retried on the next step.
 */
export function createTakeProfitWatch(deps: { account: AccountBroker; market: Pick<MarketBroker, 'getQuote'>;
  signals: IntradaySignalRepository; report: (event: string, detail?: Record<string, string>) => void; now?: () => Date;
  /** Owner switch for today; off skips the step. */
  isEnabled?: (() => Promise<boolean>) | undefined }) {
  const now = deps.now ?? (() => new Date());
  const state = { date: '', recorded: new Set<string>() };
  return async () => {
    const at = now();
    const today = seoulOrderDate(at.toISOString());
    const seoul = new Date(at.getTime() + 9 * 3600000);
    const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
    if (krxSessionStatus(today) !== 'session' || minute < WATCH_START_MINUTE || minute >= WATCH_END_MINUTE) return;
    if (state.date !== today) Object.assign(state, { date: today, recorded: new Set<string>() });
    if (deps.isEnabled && !await deps.isEnabled()) return;
    const portfolio = await deps.account.getPortfolio().catch(() => null);
    if (!portfolio) return deps.report('take_profit_watch_failed', { stage: 'portfolio' });
    for (const position of portfolio.positions) {
      const pending = TAKE_PROFIT_RULES.filter(([rule]) => !state.recorded.has(`${position.symbol}:${rule}`));
      if (pending.length === 0 || !((parseRiskDecimal(position.quantity) ?? 0n) > 0n)) continue;
      const quote = await deps.market.getQuote(position.symbol).catch(() => null);
      if (!quote) { deps.report('take_profit_watch_failed', { stage: 'quote', symbol: position.symbol }); continue; }
      const age = now().getTime() - Date.parse(quote.timestamp);
      if (quote.symbol !== position.symbol || !Number.isFinite(age) || age < 0 || age > MAX_QUOTE_AGE_MS) continue;
      const gain = gainBps(position.averagePrice, quote.price);
      if (gain === null) continue;
      for (const [rule, threshold] of pending) {
        if (gain < threshold) continue;
        const signal: IntradaySignal = { symbol: position.symbol, sessionDate: today, rule,
          averagePrice: position.averagePrice, price: quote.price, quantity: position.quantity, gainBps: Number(gain),
          quoteAt: quote.timestamp, detectedAt: now().toISOString() };
        const created = await deps.signals.record(signal).catch(() => null);
        if (created === null) { deps.report('take_profit_watch_failed', { stage: 'record', symbol: position.symbol }); break; }
        state.recorded.add(`${position.symbol}:${rule}`);
        if (created) deps.report('take_profit_dry_run', { symbol: signal.symbol, rule, averagePrice: signal.averagePrice, price: signal.price, gainBps: String(gain) });
      }
    }
  };
}
export type TakeProfitWatch = ReturnType<typeof createTakeProfitWatch>;
