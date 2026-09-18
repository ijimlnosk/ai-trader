import { expect, it } from 'vitest';
import { ema, rsi, atr, indicators } from './indicators.ts';
import { sampleDataset } from '../../../test/strategyFixtures.ts';
it('EMA uses an SMA seed and the standard recursive factor', () => {
  expect(ema([1, 2, 3, 4, 8], 3)).toEqual([null, null, 2, 3, 5.5]);
  expect(ema([1], 3)).toEqual([null]);
});
it('RSI uses Wilder averages and handles flat, rising and falling histories', () => {
  expect(rsi([1, 2, 3], 2)).toBe(100);
  expect(rsi([3, 2, 1], 2)).toBe(0);
  expect(rsi([1, 1, 1], 2)).toBe(50);
  expect(rsi([1, 2, 1, 3], 2)).toBeCloseTo(83.3333333333);
  expect(rsi([1, 2], 2)).toBeNull();
});
it('ATR includes gaps to prior close and uses Wilder smoothing', () => {
  const bars = [
    { open: '10', high: '11', low: '9', close: '10' },
    { open: '13', high: '14', low: '12', close: '13' },
    { open: '12', high: '13', low: '11', close: '12' },
    { open: '16', high: '17', low: '15', close: '16' },
  ].map((bar) => ({ ...bar, date: '20250102', volume: '100' }));
  expect(atr(bars.slice(0, 3), 2)).toBe(3);
  expect(atr(bars, 2)).toBe(4);
  expect(atr(bars.slice(0, 2), 2)).toBeNull();
});
it('volume ratio excludes current volume; warm-up and zero denominator remain explicit', () => {
  const bars = sampleDataset().series[0]!.candles.slice(0, 61).map((b) => ({ ...b, volume: '100' }));
  bars[60]!.volume = '500';
  expect(indicators(bars)?.volumeRatio).toBe(5);
  expect(indicators(bars.slice(0, 60))).toBeNull();
  for (const bar of bars.slice(0, 60)) bar.volume = '0';
  expect(indicators(bars)?.volumeRatio).toBeNull();
});
it('rejects invalid indicator periods and nonfinite values', () => {
  expect(() => ema([1], 0)).toThrow();
  expect(() => rsi([NaN], 2)).toThrow();
  expect(() => atr([], 1.2)).toThrow();
});
