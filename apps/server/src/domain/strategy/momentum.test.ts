import { describe, expect, it } from 'vitest';
import type { DailyCandle } from './marketData.ts';
import { DEFAULT_MOMENTUM_CONFIG, evaluateMomentum, isFirstSessionOfWeek, isRebalanceSession, type MomentumInput } from './momentum.ts';

// 130 weekday sessions ending 2026-09-29; price path from a per-day growth rate.
const dates: string[] = [];
for (const day = new Date('2026-09-29T00:00:00Z'); dates.length < 130; day.setUTCDate(day.getUTCDate() - 1)) {
  if (![0, 6].includes(day.getUTCDay())) dates.unshift(day.toISOString().slice(0, 10).replaceAll('-', ''));
}
const path = (growth: number, lastMultiplier = 1): DailyCandle[] => dates.map((date, i) => {
  const close = Math.round(10000 * (1 + growth) ** i * (i === dates.length - 1 ? lastMultiplier : 1));
  return { date, open: String(close), high: String(close), low: String(close), close: String(close), volume: '1000' };
});
const input = (series: MomentumInput['series'], holdings: [string, bigint][] = [], rebalance = true): MomentumInput =>
  ({ series, holdings: new Map(holdings), account: { cash: '10000000', totalEquity: '10000000' }, source: 'fixture', rebalance });
const bySymbol = (evaluations: ReturnType<typeof evaluateMomentum>) => Object.fromEntries(evaluations.map((e) => [e.symbol, e]));

describe('momentum rotation', () => {
  it('buys the top entry ranks among rising stocks above their trend and sizes to the allocation', () => {
    const series = ['000001', '000002', '000003', '000004', '000005', '000006', '000007'].map((symbol, i) => ({ symbol, candles: path(0.001 * (i + 1)) }));
    series.push({ symbol: '000008', candles: path(-0.001) });
    const result = bySymbol(evaluateMomentum(input(series)));
    expect(['000007', '000006', '000005', '000004', '000003'].map((s) => result[s]!.reason)).toEqual(Array(5).fill('MOMENTUM_ENTRY'));
    expect(result['000002']!.reason).toBe('NO_ENTRY');
    expect(result['000008']!.reason).toBe('NO_ENTRY');
    expect(result['000007']!.metrics!.rank).toBe(0);
    expect(result['000008']!.metrics!.rank).toBeNull();
    const price = Number(result['000007']!.proposal!.estimatedPrice);
    expect(result['000007']!.proposal).toMatchObject({ side: 'BUY', quantity: String(Math.floor(900000 / price)) });
    expect(result['000007']!.score[0]).toBeGreaterThan(result['000006']!.score[0]!);
  });

  it('exits held positions below the trend daily and on rank loss only at rebalance', () => {
    const series = [{ symbol: '000001', candles: path(0.002, 0.8) }, { symbol: '000002', candles: path(0.001) },
      ...Array.from({ length: 10 }, (_, i) => ({ symbol: `10000${i}`.slice(0, 6), candles: path(0.003 + i * 0.0001) }))];
    const daily = bySymbol(evaluateMomentum(input(series, [['000001', 5n], ['000002', 5n]], false)));
    expect(daily['000001']).toMatchObject({ reason: 'TREND_EXIT', proposal: { side: 'SELL', quantity: '5' } });
    expect(daily['000002']!.reason).toBe('HOLD_POSITION');
    expect(daily['100000']!.reason).toBe('NOT_REBALANCE_DAY');
    const weekly = bySymbol(evaluateMomentum(input(series, [['000002', 5n]], true)));
    expect(weekly['000002']).toMatchObject({ reason: 'RANK_EXIT', proposal: { side: 'SELL', quantity: '5' } });
  });

  it('trims a winner above the threshold back to the allocation, exactly at the boundary', () => {
    const candles = path(0.002);
    const price = BigInt(candles.at(-1)!.close);
    const atLimit = 1500000n / price; // value <= 15% of 10,000,000 is kept
    const over = atLimit + 1n;
    const keep = bySymbol(evaluateMomentum(input([{ symbol: '000001', candles }], [['000001', atLimit]], false)));
    expect(keep['000001']!.reason).toBe('HOLD_POSITION');
    const trim = bySymbol(evaluateMomentum(input([{ symbol: '000001', candles }], [['000001', over]], false)));
    expect(trim['000001']).toMatchObject({ reason: 'TRIM', proposal: { side: 'SELL', quantity: String(over - 900000n / price) } });
  });

  it('needs lookback + 1 bars and never proposes without history', () => {
    const short = path(0.01).slice(-DEFAULT_MOMENTUM_CONFIG.lookback);
    expect(evaluateMomentum(input([{ symbol: '000001', candles: short }]))[0]).toMatchObject({ reason: 'INSUFFICIENT_HISTORY', proposal: null, metrics: null });
  });

  it('caps entry size by available cash', () => {
    const result = evaluateMomentum({ ...input([{ symbol: '000001', candles: path(0.002) }]), account: { cash: '100000', totalEquity: '10000000' } })[0]!;
    expect(result.proposal!.quantity).toBe(String(Math.floor(100000 / Number(result.proposal!.estimatedPrice))));
  });
});

describe('weekly rebalance day', () => {
  it('is the first session of an ISO week, including after a Monday holiday', () => {
    expect(isFirstSessionOfWeek('20260925', '20260928')).toBe(true); // Fri -> Mon
    expect(isFirstSessionOfWeek('20260928', '20260929')).toBe(false);
    expect(isFirstSessionOfWeek('20261002', '20261006')).toBe(true); // Fri -> Tue (Mon closed)
    expect(isFirstSessionOfWeek(undefined, '20260929')).toBe(true);
  });
});

describe('rebalance cadence', () => {
  it('rebalances every session by default and only on the first weekly session when configured weekly', () => {
    expect(DEFAULT_MOMENTUM_CONFIG.rebalanceCadence).toBe('daily');
    expect(isRebalanceSession('20260928', '20260929')).toBe(true);
    const weekly = { ...DEFAULT_MOMENTUM_CONFIG, rebalanceCadence: 'weekly' as const };
    expect(isRebalanceSession('20260928', '20260929', weekly)).toBe(false);
    expect(isRebalanceSession('20261002', '20261006', weekly)).toBe(true);
  });
});
