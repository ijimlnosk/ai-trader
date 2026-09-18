import { sampleDataset, prefix } from './strategyFixtures.ts';
import { setupOrders, time } from './orderFixtures.ts';
import { createStrategyService } from '../src/application/strategy/index.ts';
import { createOrderServices } from '../src/application/orders/index.ts';
import { createPaperPortfolioRiskContextProvider } from '../src/application/paperRiskContext.ts';

export function strategySetup() {
  const s = setupOrders();
  const data = prefix(sampleDataset(), 99);
  // Known entry prices, shifted to the last completed session preceding the test clock.
  const date = new Date('2026-09-15T00:00:00.000Z');
  const dates: string[] = [];
  while (dates.length < 99) {
    if (![0, 6].includes(date.getUTCDay())) dates.unshift(date.toISOString().slice(0, 10).replaceAll('-', ''));
    date.setUTCDate(date.getUTCDate() - 1);
  }
  data.sessions = dates;
  for (const series of data.series) series.candles.forEach((bar, i) => { bar.date = dates[i]!; });
  s.market.getQuote.mockImplementation(async () => ({ symbol: '005930', price: data.series[0]!.candles.at(-1)!.close,
    change: '0', changeRate: '0', volume: '1', timestamp: time }));
  const deps = { account: s.account, risk: createPaperPortfolioRiskContextProvider(s.account, s.repository, false, s.deps.now),
    orders: createOrderServices(s.deps), now: () => new Date(time) };
  return { ...s, data, strategyDeps: deps, evaluate: createStrategyService(deps) };
}
