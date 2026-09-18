import { expect, it } from 'vitest';
import { parseDataset } from './dataset.ts';
import { sampleDataset } from './sample.ts';
it('accepts explicit raw daily data and rejects duplicates, missing sessions and out-of-order bars', () => {
  expect(parseDataset(sampleDataset()).series).toHaveLength(2);
  for (const mutate of [
    (d: ReturnType<typeof sampleDataset>) => { d.series[0]!.candles.reverse(); },
    (d: ReturnType<typeof sampleDataset>) => { d.series[0]!.candles.splice(2, 1); },
    (d: ReturnType<typeof sampleDataset>) => { d.series[0]!.candles[1]!.date = d.series[0]!.candles[0]!.date; },
    (d: ReturnType<typeof sampleDataset>) => { d.series[1]!.symbol = d.series[0]!.symbol; },
  ]) { const data = sampleDataset(); mutate(data); expect(() => parseDataset(data)).toThrow(); }
});
it.each([
  { open: '0' }, { close: 'NaN' }, { high: '1' }, { low: '-1' }, { volume: '1.5' },
  { date: '20250230' }, { date: '20250104' }, { close: '1e5' }, { open: '1.000000001' },
])('rejects malformed OHLCV %j', (invalid) => {
  const data = sampleDataset(); Object.assign(data.series[0]!.candles[0]!, invalid);
  expect(() => parseDataset(data)).toThrow();
});
it('requires declared timezone and raw price basis rather than silently mixing adjusted data', () => {
  expect(() => parseDataset({ ...sampleDataset(), timezone: 'UTC' })).toThrow();
  expect(() => parseDataset({ ...sampleDataset(), priceBasis: 'adjusted' })).toThrow();
});
