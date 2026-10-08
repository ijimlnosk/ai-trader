import { describe, expect, it } from 'vitest';
import type { ShadowTrade } from '../../domain/strategy/shadowLedger.ts';
import { DAY_V1 } from '../../domain/strategy/dayTrading.ts';
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

describe('shadow day trader quiet window', () => {
  it('makes no quote calls from 09:04 to 09:10 and stops a sweep that reaches 09:04', async () => {
    let calls = 0; let now = kst('09:05');
    const step = createShadowDayTrader({ symbols: ['A', 'B', 'C'], now: () => now, report: () => {}, trades: { list: async () => [], record: async () => {} },
      market: { getQuote: async (symbol) => { calls += 1; if (calls === 2) now = kst('09:04'); return { symbol, price: '10000', change: '0', changeRate: '3.00', volume: '1',
        timestamp: new Date(now.getTime() - 1000).toISOString() }; } } });
    await step();
    expect(calls).toBe(0);
    now = kst('09:03'); await step();
    expect(calls).toBe(2);
  });
});

describe('shadow day trader owner settings', () => {
  it('stops new entries when disabled but still exits holdings, and manages exits after a late restart', async () => {
    const saved: ShadowTrade[] = [{ sessionDate: '20261007', symbol: 'A', side: 'BUY', quantity: 10n, quotePrice: 10000n, fillPrice: 10010n, feesKrw: 20n, reason: 'ENTRY', createdAt: '' }];
    let calls = 0;
    const make = (time: string, enabled: boolean) => createShadowDayTrader({ symbols: ['A', 'B'], now: () => kst(time), report: () => {},
      settings: async () => ({ enabled, config: DAY_V1 }),
      market: { getQuote: async (symbol) => { calls += 1; return { symbol, price: symbol === 'A' ? '9700' : '10000', change: '0', changeRate: '3.00', volume: '1',
        timestamp: new Date(kst(time).getTime() - 1000).toISOString() }; } },
      trades: { list: async () => [...saved], record: async (_s, trade) => { saved.push(trade); } } });
    const disabled = make('09:01', false);
    await disabled(); expect(calls).toBe(0);
    const later = make('09:30', false); await later();
    expect(saved.at(-1)).toMatchObject({ symbol: 'A', side: 'SELL', reason: 'STOP' });
    saved.splice(1); saved[0] = { ...saved[0]!, sessionDate: '20261008' };
    const lateRestart = make('14:45', true); await lateRestart();
    expect(saved.at(-1)).toMatchObject({ symbol: 'A', side: 'SELL', reason: 'STOP' });
  });
});
