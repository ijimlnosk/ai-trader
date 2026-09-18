import { sampleDataset } from '../src/infrastructure/market/sample.ts';
import type { MarketDataset } from '../src/domain/strategy/marketData.ts';
export { sampleDataset };
export function prefix(data: MarketDataset, length: number): MarketDataset {
  return { ...data, sessions: data.sessions.slice(0, length),
    series: data.series.map((series) => ({ ...series, candles: series.candles.slice(0, length) })) };
}
export const flatAccount = { cash: '10000000', totalEquity: '10000000', heldQuantity: '0' };
