import { parseRiskDecimal } from '../risk/decimal.ts';

/**
 * Research candidate (docs/INTRADAY_THRESHOLDS_RESEARCH_2026-10-06.md): full take profit once the price
 * is 30% above the average purchase price. Recorded only until a separate approval.
 */
export const TAKE_PROFIT_BPS = 3000n;

/** Thresholds recorded side by side for comparison (owner request 2026-10-07): +5%, +10% and the +30% candidate. */
export const TAKE_PROFIT_RULES = [['TAKE_PROFIT_5', 500n], ['TAKE_PROFIT_10', 1000n], ['TAKE_PROFIT_30', TAKE_PROFIT_BPS]] as const;
export type TakeProfitRule = (typeof TAKE_PROFIT_RULES)[number][0];

/** Gain of `price` over `averagePrice` in basis points (floored), or null unless both are positive decimals. */
export function gainBps(averagePrice: string, price: string): bigint | null {
  const average = parseRiskDecimal(averagePrice);
  const current = parseRiskDecimal(price);
  if (average === null || current === null || average <= 0n || current <= 0n) return null;
  const difference = (current - average) * 10000n;
  // BigInt division truncates toward zero; floor keeps a loss just below zero negative.
  return difference / average - (difference % average < 0n ? 1n : 0n);
}

export function hasReachedTakeProfit(averagePrice: string, price: string, thresholdBps = TAKE_PROFIT_BPS): boolean {
  const gain = gainBps(averagePrice, price);
  return gain !== null && gain >= thresholdBps;
}
