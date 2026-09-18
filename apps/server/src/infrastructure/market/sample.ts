import type { MarketDataset } from '../../domain/strategy/marketData.ts';
/** Synthetic oscillating fixture, not historical Samsung prices or performance evidence. */
export function sampleDataset(): MarketDataset {
  const sessions: string[] = [];
  const date = new Date('2025-01-02T00:00:00.000Z');
  while (sessions.length < 220) {
    if (date.getUTCDay() > 0 && date.getUTCDay() < 6) sessions.push(date.toISOString().slice(0, 10).replaceAll('-', ''));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return { source: 'synthetic-v1; weekdays only, NOT actual KRX calendar', timezone: 'Asia/Seoul', priceBasis: 'raw', sessions,
    series: ['005930', '000660'].map((symbol, symbolIndex) => ({ symbol, candles: sessions.map((date, i) => {
      const close = Math.round(50000 + symbolIndex * 10000 + Math.sin(i / 15) * 5000 + Math.sin(i * 2) * 2000);
      const open = close + (i % 2 ? 100 : -100);
      return { date, open: String(open), high: String(Math.max(open, close) + 500), low: String(Math.min(open, close) - 500),
        close: String(close), volume: String(i % 2 === 0 ? 300000 : 100000) };
    }) })) };
}
