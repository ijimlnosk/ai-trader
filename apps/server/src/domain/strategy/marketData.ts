import { ledgerAmount } from '../tradeLedger.ts';
import { validTradeDate } from '../tradeLedger.ts';

import type { DailyCandle, MarketDataset } from '@ai-trader/contracts';
export type { DailyCandle, MarketDataset } from '@ai-trader/contracts';
export function candleTime(date: string, event: 'open' | 'close'): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T${event === 'open' ? '00:00' : '06:30'}:00.000Z`;
}
export function validateCandles(candles: readonly DailyCandle[]): void {
  let previous = '';
  for (const bar of candles) {
    if (!validTradeDate(bar.date) || bar.date <= previous) throw new Error('Invalid candle ordering/date');
    const weekday = new Date(candleTime(bar.date, 'open')).getUTCDay();
    if (weekday === 0 || weekday === 6) throw new Error('Non-session candle');
    const [open, high, low, close] = [bar.open, bar.high, bar.low, bar.close].map(ledgerAmount);
    if (!open || !high || !low || !close || low > high || low > open || low > close || high < open || high < close) {
      throw new Error('Invalid OHLC prices');
    }
    if (!/^\d{1,16}$/.test(bar.volume)) throw new Error('Invalid candle volume');
    previous = bar.date;
  }
}
export function validateDataset(data: MarketDataset): void {
  if (!data.source.trim() || data.timezone !== 'Asia/Seoul' || data.priceBasis !== 'raw'
    || !data.sessions.length || !data.series.length) throw new Error('Invalid market dataset');
  const symbols = new Set<string>();
  for (const series of data.series) {
    if (!/^\d{6}$/.test(series.symbol) || symbols.has(series.symbol)) throw new Error('Invalid universe');
    symbols.add(series.symbol);
    validateCandles(series.candles);
    if (series.candles.length !== data.sessions.length
      || series.candles.some((bar, i) => bar.date !== data.sessions[i])) throw new Error('Missing/unexpected session');
  }
}
