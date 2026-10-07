import { describe, expect, it } from 'vitest';
import type { ShadowTrade } from '../../domain/strategy/shadowLedger.ts';
import { createShadowDayTrader } from './shadowDayTrader.ts';

// 2026-10-08 (session) at HH:MM KST.
const kst = (hhmm: string) => new Date(`2026-10-08T${hhmm}:00+09:00`);

function setup(symbols = ['A', 'B', 'C', 'D']) {
  let now = kst('09:01');
  const market: Record<string, { price: string; changeRate: string; volume: string }> = {
    A: { price: '10000', changeRate: '3.00', volume: '900000' }, B: { price: '10000', changeRate: '0.50', volume: '999999' },
    C: { price: '10000', changeRate: '9.00', volume: '999999' }, D: { price: '20000', changeRate: '2.00', volume: '100000' } };
  const saved: ShadowTrade[] = []; const events: string[] = [];
  const step = createShadowDayTrader({ symbols, now: () => now, report: (event) => events.push(event),
    market: { getQuote: async (symbol) => ({ symbol, change: '0', timestamp: new Date(now.getTime() - 1000).toISOString(), ...market[symbol]! }) },
    trades: { list: async () => [...saved], record: async (_strategy, trade) => { saved.push(trade); } } });
  return { step, saved, events, market, at: (hhmm: string) => { now = kst(hhmm); } };
}
const summary = (trades: ShadowTrade[]) => trades.map((t) => `${t.side} ${t.symbol} ${t.quantity} ${t.reason}`);

describe('shadow day trader (virtual, order-free)', () => {
  it('sweeps, enters the strength band, takes +5%, re-buys 2% lower and stops out at −3%', async () => {
    const s = setup();
    await s.step();
    expect(s.saved).toEqual([]);
    s.at('09:10'); await s.step();
    expect(summary(s.saved)).toEqual(['BUY A 16 ENTRY', 'BUY D 8 ENTRY']);
    s.market.A!.price = '10520'; s.at('09:30'); await s.step();
    expect(summary(s.saved).at(-1)).toBe('SELL A 16 TARGET');
    s.market.A!.price = '10320'; s.at('09:40'); await s.step();
    expect(s.saved).toHaveLength(3);
    s.market.A!.price = '10300'; s.at('09:50'); await s.step();
    expect(summary(s.saved).at(-1)).toMatch(/^BUY A \d+ REBUY$/);
    s.market.D!.price = '19380'; s.at('10:00'); await s.step();
    expect(summary(s.saved).at(-1)).toBe('SELL D 8 STOP');
  });

  it('sells winners at 15:15 and holds a loser that is above its first price', async () => {
    const s = setup(['A', 'D']);
    await s.step(); s.at('09:10'); await s.step();
    // D's entry fill is 20,020 (10 bp slippage); 20,010 is a loss but above its first price of 20,000.
    s.market.A!.price = '10100'; s.market.D!.price = '20010'; s.at('15:15'); await s.step();
    expect(summary(s.saved).slice(2)).toEqual(['SELL A 16 CLOSE']);
    await s.step();
    expect(s.saved).toHaveLength(3);
  });

  it('does nothing on closures, before the sweep, after 15:20 or on stale quotes', async () => {
    for (const time of ['2026-10-09T10:00:00+09:00', '2026-10-08T08:59:00+09:00', '2026-10-08T15:20:00+09:00']) {
      const s = setup(); s.at('09:01');
      const step = createShadowDayTrader({ symbols: ['A'], now: () => new Date(time), report: () => {}, market: { getQuote: async () => { throw new Error('no'); } },
        trades: { list: async () => [], record: async () => { throw new Error('no'); } } });
      await step();
    }
    const stale = setup(['A']);
    stale.market.A!.price = '10000';
    const step = createShadowDayTrader({ symbols: ['A'], now: () => kst('09:10'), report: () => {}, trades: { list: async () => [], record: async () => { throw new Error('no'); } },
      market: { getQuote: async (symbol) => ({ symbol, price: '10000', change: '0', changeRate: '3.00', volume: '1', timestamp: kst('09:09').toISOString() }) } });
    await step(); await step();
  });
});
