import type { DailyCandle } from './marketData.ts';

function periodCheck(period: number): void {
  if (!Number.isSafeInteger(period) || period < 1) throw new Error('Invalid indicator period');
}
/** SMA seed; null denotes warm-up, never a fabricated zero. */
export function ema(values: readonly number[], period: number): (number | null)[] {
  periodCheck(period);
  if (values.some((v) => !Number.isFinite(v))) throw new Error('Invalid indicator input');
  let current = 0;
  return values.map((value, i) => {
    if (i < period) current += value / period;
    else current += (value - current) * 2 / (period + 1);
    return i < period - 1 ? null : current;
  });
}
export function rsi(values: readonly number[], period = 14): number | null {
  periodCheck(period);
  if (values.some((v) => !Number.isFinite(v))) throw new Error('Invalid indicator input');
  if (values.length <= period) return null;
  let gain = 0; let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    if (i <= period) { gain += Math.max(change, 0) / period; loss += Math.max(-change, 0) / period; }
    else { gain = (gain * (period - 1) + Math.max(change, 0)) / period; loss = (loss * (period - 1) + Math.max(-change, 0)) / period; }
  }
  return loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
}
export function atr(candles: readonly DailyCandle[], period = 14): number | null {
  periodCheck(period);
  if (candles.length <= period) return null;
  let value = 0;
  for (let i = 1; i < candles.length; i++) {
    const bar = candles[i]!; const previous = Number(candles[i - 1]!.close);
    const range = Math.max(Number(bar.high) - Number(bar.low), Math.abs(Number(bar.high) - previous), Math.abs(Number(bar.low) - previous));
    value = i <= period ? value + range / period : (value * (period - 1) + range) / period;
  }
  return value;
}
export interface Indicators {
  ema20: number; ema60: number; previousEma20: number; previousEma60: number;
  rsi14: number; atr14: number; volumeRatio: number | null;
  trend: 'up' | 'down' | 'mixed';
}
export function indicators(candles: readonly DailyCandle[]): Indicators | null {
  if (candles.length < 61) return null;
  const closes = candles.map((bar) => Number(bar.close));
  const fast = ema(closes, 20); const slow = ema(closes, 60);
  const ema20 = fast.at(-1)!; const ema60 = slow.at(-1)!; const close = closes.at(-1)!;
  const average = candles.slice(-21, -1).reduce((sum, bar) => sum + Number(bar.volume), 0) / 20;
  return { ema20, ema60, previousEma20: fast.at(-2)!, previousEma60: slow.at(-2)!,
    rsi14: rsi(closes)!, atr14: atr(candles)!, volumeRatio: average === 0 ? null : Number(candles.at(-1)!.volume) / average,
    trend: ema20 > ema60 && close > ema20 ? 'up' : ema20 < ema60 && close < ema20 ? 'down' : 'mixed' };
}
