import type { TradeProposal } from '../risk/index.ts';
import { DECIMAL_SCALE } from '../risk/decimal.ts';
import { ledgerAmount } from '../tradeLedger.ts';
import { candleTime, type DailyCandle } from './marketData.ts';

export const MOMENTUM_IDENTITY = { strategyId: 'momentum-rotation', version: '1' } as const;

/**
 * Selected in the 2026-09-30 walk-forward study (docs/STRATEGY_RESEARCH_2026-09-30.md); daily
 * rebalancing chosen by the owner on 2026-10-01 (decision 0016).
 */
export interface MomentumConfig { lookback: number; trendMa: number; keepRank: number; entryRanks: number;
  allocationBps: number; trimAboveBps: number; rebalanceCadence: 'daily' | 'weekly' }
export const DEFAULT_MOMENTUM_CONFIG: Readonly<MomentumConfig> = Object.freeze({
  lookback: 120, trendMa: 120, keepRank: 10, entryRanks: 5, allocationBps: 900, trimAboveBps: 1500, rebalanceCadence: 'daily' });

export type MomentumReason = 'MOMENTUM_ENTRY' | 'TREND_EXIT' | 'RANK_EXIT' | 'TRIM' | 'HOLD_POSITION'
  | 'NO_ENTRY' | 'NOT_REBALANCE_DAY' | 'INSUFFICIENT_HISTORY' | 'SIZE_UNAVAILABLE';

export interface MomentumEvaluation {
  strategyId: typeof MOMENTUM_IDENTITY.strategyId; version: typeof MOMENTUM_IDENTITY.version;
  symbol: string; evaluatedAt: string; source: string; reason: MomentumReason; proposal: TradeProposal | null;
  /** Whole shares held when evaluated. */
  heldQuantity: string;
  /** Ranking key for the session plan: higher first. */
  score: readonly number[];
  metrics: { momentum: number; trendMa: number; close: string; rank: number | null } | null;
}

export interface MomentumInput {
  series: readonly { symbol: string; candles: readonly DailyCandle[] }[];
  /** Whole shares held per symbol. */
  holdings: ReadonlyMap<string, bigint>;
  account: { cash: string; totalEquity: string };
  source: string;
  /** Entries and rank exits only on rebalance sessions; trend exits and trims are daily. */
  rebalance: boolean;
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** First session of an ISO week (Mon–Sun) given two consecutive YYYYMMDD sessions. */
export function isFirstSessionOfWeek(previous: string | undefined, current: string): boolean {
  if (!previous) return true;
  const day = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6));
  const monday = (date: string) => { const t = day(date); return t - ((new Date(t).getUTCDay() + 6) % 7) * 86400000; };
  return monday(previous) !== monday(current);
}

/** Whether entries and rank exits run at the close of `current`, per the configured cadence. */
export function isRebalanceSession(previous: string | undefined, current: string,
  config: Readonly<MomentumConfig> = DEFAULT_MOMENTUM_CONFIG): boolean {
  return config.rebalanceCadence === 'daily' || isFirstSessionOfWeek(previous, current);
}

/**
 * Cross-sectional momentum rotation at the close of the last bar. Pure: indicators use numbers
 * only for ranking; quantities and money are exact integers/strings. Risk is applied by the plan.
 */
export function evaluateMomentum(input: MomentumInput, config: Readonly<MomentumConfig> = DEFAULT_MOMENTUM_CONFIG): MomentumEvaluation[] {
  const equity = ledgerAmount(input.account.totalEquity);
  const cash = ledgerAmount(input.account.cash);
  const rows = input.series.map(({ symbol, candles }) => {
    const bar = candles.at(-1);
    if (!bar || candles.length < Math.max(config.lookback, config.trendMa) + 1) return { symbol, bar, metrics: null };
    const closes = candles.map((candle) => Number(candle.close));
    const close = closes.at(-1)!;
    const trendMa = mean(closes.slice(-config.trendMa));
    const momentum = close / closes[closes.length - 1 - config.lookback]! - 1;
    return { symbol, bar, metrics: { momentum, trendMa, close: bar.close, eligible: close > trendMa && momentum > 0 } };
  });
  const ranked = rows.filter((row) => row.metrics?.eligible).sort((a, b) => b.metrics!.momentum - a.metrics!.momentum
    || (a.symbol < b.symbol ? -1 : 1));
  const rankOf = new Map(ranked.map((row, index) => [row.symbol, index]));
  return rows.map(({ symbol, bar, metrics }): MomentumEvaluation => {
    const held = input.holdings.get(symbol) ?? 0n;
    const base = { ...MOMENTUM_IDENTITY, symbol, evaluatedAt: bar ? candleTime(bar.date, 'close') : '', source: input.source, heldQuantity: held.toString(),
      score: metrics ? [metrics.momentum] : [], metrics: metrics ? { momentum: metrics.momentum, trendMa: metrics.trendMa,
        close: metrics.close, rank: rankOf.get(symbol) ?? null } : null };
    const proposal = (side: 'BUY' | 'SELL', shares: bigint): TradeProposal => ({ symbol, side, quantity: shares.toString(),
      estimatedPrice: bar!.close, confidence: '1', createdAt: base.evaluatedAt });
    if (!metrics || !bar) return { ...base, reason: 'INSUFFICIENT_HISTORY', proposal: null };
    const rank = rankOf.get(symbol);
    const price = ledgerAmount(bar.close);
    if (held > 0n) {
      if (!(Number(bar.close) > metrics.trendMa)) return { ...base, reason: 'TREND_EXIT', proposal: proposal('SELL', held) };
      if (input.rebalance && (rank === undefined || rank >= config.keepRank)) return { ...base, reason: 'RANK_EXIT', proposal: proposal('SELL', held) };
      // Trim back to the allocation once a winner exceeds the trim threshold of equity.
      if (price * held * 10000n > equity * BigInt(config.trimAboveBps)) {
        const target = equity * BigInt(config.allocationBps) / (10000n * price);
        if (target < held) return { ...base, reason: 'TRIM', proposal: proposal('SELL', held - target) };
      }
      return { ...base, reason: 'HOLD_POSITION', proposal: null };
    }
    if (!input.rebalance) return { ...base, reason: 'NOT_REBALANCE_DAY', proposal: null };
    if (rank === undefined || rank >= config.entryRanks) return { ...base, reason: 'NO_ENTRY', proposal: null };
    const budget = equity * BigInt(config.allocationBps) / 10000n;
    const shares = (budget < cash ? budget : cash) / price;
    if (shares <= 0n || shares > 999999999n) return { ...base, reason: 'SIZE_UNAVAILABLE', proposal: null };
    return { ...base, reason: 'MOMENTUM_ENTRY', proposal: proposal('BUY', shares) };
  });
}

/** Whole shares from a decimal quantity string (holdings are integral for domestic stocks). */
export const wholeShares = (quantity: string): bigint => ledgerAmount(quantity) / DECIMAL_SCALE;
