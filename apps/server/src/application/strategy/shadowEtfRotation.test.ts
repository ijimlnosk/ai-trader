import { describe, expect, it } from 'vitest';
import { rankEtfs } from '../../domain/strategy/etfRotation.ts';
import type { ShadowTrade } from '../../domain/strategy/shadowLedger.ts';
import { createShadowEtfRotation } from './shadowEtfRotation.ts';

const kst = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+09:00`);
// 130 rising (or falling) closes ending at `last`.
const closes = (last: number, step: number) => Array.from({ length: 130 }, (_, i) => last - (129 - i) * step);

describe('ETF ranking', () => {
  it('keeps positive returns above the 120-day average, best first', () => {
    expect(rankEtfs([{ symbol: 'A', closes: closes(10000, 10) }, { symbol: 'B', closes: closes(10000, 30) }, { symbol: 'C', closes: closes(10000, -10) },
      { symbol: 'D', closes: closes(10000, 10).slice(-100) }])).toEqual(['B', 'A']);
  });
});

describe('shadow ETF rotation (virtual, order-free)', () => {
  function setup(steps: Record<string, number>) {
    const saved: ShadowTrade[] = []; let now = kst('2026-10-12', '09:20'); let historyCalls = 0;
    const step = createShadowEtfRotation({ symbols: Object.keys(steps), now: () => now, report: () => {},
      history: { getDailyHistory: async (symbol, _from, through) => { historyCalls += 1; return { source: 's', retrievedAt: '', rawSha256: '',
        candles: closes(10000, steps[symbol]!).map((close, i) => ({ date: i === 129 ? through : `2026${String(i).padStart(4, '0')}`, open: String(close), high: String(close), low: String(close), close: String(close), volume: '1' })) }; } },
      market: { getQuote: async (symbol) => ({ symbol, price: '10000', change: '0', changeRate: '0', volume: '1', timestamp: new Date(now.getTime() - 1000).toISOString() }) },
      trades: { list: async () => [...saved], record: async (_strategy, trade) => { saved.push(trade); } } });
    return { step, saved, at: (date: string, hhmm: string) => { now = kst(date, hhmm); }, historyCalls: () => historyCalls };
  }

  it('buys the top 3 on the first session of the week, once, and not mid-week', async () => {
    const s = setup({ A: 10, B: 30, C: 20, D: 5, E: -10 });
    await s.step();
    expect(s.saved.map((t) => `${t.side} ${t.symbol} ${t.reason}`)).toEqual(['BUY B ROTATE_IN', 'BUY C ROTATE_IN', 'BUY A ROTATE_IN']);
    expect(s.saved[0]).toMatchObject({ sessionDate: '20261012', quantity: 16n, fillPrice: 10010n });
    await s.step();
    expect(s.saved).toHaveLength(3);
    s.at('2026-10-13', '09:20'); await s.step();
    expect(s.saved).toHaveLength(3);
  });

  it('does nothing before 09:20 or after 14:00', async () => {
    const s = setup({ A: 10 });
    s.at('2026-10-12', '09:19'); await s.step();
    s.at('2026-10-12', '14:00'); await s.step();
    expect(s.historyCalls()).toBe(0);
  });
});
