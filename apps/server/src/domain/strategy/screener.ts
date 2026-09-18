import { ledgerAmount, ledgerDecimal } from '../tradeLedger.ts';
import type { StrategyConfig } from './config.ts';
import { validateCandles, type DailyCandle } from './marketData.ts';
export interface ScreenResult {
  symbol: string; included: boolean; reasons: string[]; averageTurnover: string | null;
}
export function screenSymbol(symbol: string, candles: readonly DailyCandle[], config: Readonly<StrategyConfig>): ScreenResult {
  validateCandles(candles);
  const reasons: string[] = [];
  if (candles.length < 61) reasons.push('INSUFFICIENT_HISTORY');
  const current = candles.at(-1);
  if (current && ledgerAmount(current.close) < ledgerAmount(config.minPrice)) reasons.push('PRICE_BELOW_MINIMUM');
  const previous = candles.slice(-21, -1);
  const sum = previous.reduce((total, bar) => total + ledgerAmount(bar.close) * BigInt(bar.volume), 0n);
  const enough = previous.length === 20;
  if (enough && sum < ledgerAmount(config.minAverageTurnover) * 20n) reasons.push('TURNOVER_BELOW_MINIMUM');
  return { symbol, included: reasons.length === 0, reasons, averageTurnover: enough ? ledgerDecimal(sum / 20n) : null };
}
