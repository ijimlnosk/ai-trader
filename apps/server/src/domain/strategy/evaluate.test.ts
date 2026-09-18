import { expect, it } from 'vitest';
import { evaluateStrategy } from './evaluate.ts';
import { DEFAULT_STRATEGY_CONFIG } from './config.ts';
import { sampleDataset, flatAccount } from '../../../test/strategyFixtures.ts';
const data = sampleDataset();
const series = data.series[0]!;
it('generates an auditable BUY only on the qualifying crossover', () => {
  const signal = evaluateStrategy(series.symbol, series.candles.slice(0, 99), flatAccount, data.source);
  expect(signal.reason).toBe('BULLISH_CROSS');
  expect(signal.proposal).toMatchObject({ symbol: series.symbol, side: 'BUY', confidence: '1' });
  expect(signal.indicators).toMatchObject({ trend: 'up' });
  expect(signal.configId).toContain('100000000');
  expect(evaluateStrategy(series.symbol, series.candles.slice(0, 98), flatAccount, data.source).proposal).toBeNull();
  expect(evaluateStrategy(series.symbol, series.candles.slice(0, 100), flatAccount, data.source).proposal).toBeNull();
});
it('caps position size by cash and ATR risk and reports unavailable size', () => {
  const bars = series.candles.slice(0, 99);
  const one = evaluateStrategy(series.symbol, bars, { ...flatAccount, cash: bars.at(-1)!.close }, data.source);
  expect(one.proposal?.quantity).toBe('1');
  expect(evaluateStrategy(series.symbol, bars, { ...flatAccount, cash: '1' }, data.source).reason).toBe('SIZE_UNAVAILABLE');
  const small = evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...DEFAULT_STRATEGY_CONFIG, riskBudgetBps: 1 });
  expect(small.reason).toBe('SIZE_UNAVAILABLE');
});
it('holds existing positions on entry and exits all shares even below liquidity filters', () => {
  const account = { ...flatAccount, heldQuantity: '5' };
  expect(evaluateStrategy(series.symbol, series.candles.slice(0, 99), account, data.source).reason).toBe('HOLD_POSITION');
  const exit = evaluateStrategy(series.symbol, series.candles.slice(0, 70), account, data.source,
    { ...DEFAULT_STRATEGY_CONFIG, minAverageTurnover: '999999999999' });
  expect(exit.screen.included).toBe(false);
  expect(exit.proposal).toMatchObject({ side: 'SELL', quantity: '5' });
});
it('filters with explicit reasons and rejects invalid account/config', () => {
  expect(evaluateStrategy(series.symbol, [], flatAccount, data.source).reason).toBe('INSUFFICIENT_HISTORY');
  const bars = series.candles.slice(0, 99);
  const filtered = evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...DEFAULT_STRATEGY_CONFIG, minPrice: '999999' });
  expect(filtered.reason).toBe('SCREENED_OUT');
  expect(filtered.screen.reasons).toContain('PRICE_BELOW_MINIMUM');
  expect(() => evaluateStrategy(series.symbol, bars, { ...flatAccount, heldQuantity: '0.5' }, data.source)).toThrow();
  expect(() => evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...DEFAULT_STRATEGY_CONFIG, maxRsi: 101 })).toThrow();
});
it('records exact screener turnover threshold and excludes current turnover', () => {
  const bars = series.candles.slice(0, 99).map((b) => ({ ...b, open: '1000', high: '1000', low: '1000', close: '1000', volume: '10' }));
  bars.at(-1)!.volume = '1000000';
  const exact = evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...DEFAULT_STRATEGY_CONFIG, minAverageTurnover: '10000' });
  expect(exact.screen).toMatchObject({ included: true, averageTurnover: '10000' });
  const above = evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...DEFAULT_STRATEGY_CONFIG, minAverageTurnover: '10000.00000001' });
  expect(above.screen.reasons).toContain('TURNOVER_BELOW_MINIMUM');
});
it('RSI and volume thresholds are inclusive and just-outside values suppress entry', () => {
  const bars = series.candles.slice(0, 99);
  const baseline = evaluateStrategy(series.symbol, bars, flatAccount, data.source);
  const values = baseline.indicators!;
  const exact = { ...DEFAULT_STRATEGY_CONFIG, minRsi: values.rsi14, maxRsi: values.rsi14, minVolumeRatio: values.volumeRatio! };
  expect(evaluateStrategy(series.symbol, bars, flatAccount, data.source, exact).proposal?.side).toBe('BUY');
  expect(evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...exact, minVolumeRatio: exact.minVolumeRatio + 0.000001 }).proposal).toBeNull();
  expect(evaluateStrategy(series.symbol, bars, flatAccount, data.source, { ...exact, minRsi: 0, maxRsi: exact.maxRsi - 0.000001 }).proposal).toBeNull();
});
