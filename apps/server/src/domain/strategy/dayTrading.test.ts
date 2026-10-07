import { describe, expect, it } from 'vitest';
import { buyFill, closeDecision, exitReason, isRebuy, morningWatchlist, sellFill } from './dayTrading.ts';
import { replayShadow, type ShadowTrade } from './shadowLedger.ts';

describe('day-v1 rules', () => {
  it('sizes buys within the budget including slippage and commission', () => {
    const fill = buyFill(10000n, 166_666n);
    expect(fill).toEqual({ quantity: 16n, fillPrice: 10010n, feesKrw: 33n, costKrw: 160_193n });
    expect(buyFill(200_000n, 166_666n).quantity).toBe(0n);
  });

  it('charges slippage, commission and sell tax on sales', () => {
    expect(sellFill(10500n, 16n)).toEqual({ fillPrice: 10489n, feesKrw: 370n, proceedsKrw: 167_454n });
  });

  it('exits at +5%, on a 1.5% pullback after +3%, and at −3%', () => {
    expect(exitReason(10000n, 10500n, 10500n)).toBe('TARGET');
    expect(exitReason(10000n, 10499n, 10499n)).toBeNull();
    expect(exitReason(10000n, 10400n, 10244n)).toBe('TRAIL');
    expect(exitReason(10000n, 10400n, 10245n)).toBeNull();
    expect(exitReason(10000n, 10299n, 10100n)).toBeNull();
    expect(exitReason(10000n, 10000n, 9700n)).toBe('STOP');
    expect(exitReason(10000n, 10000n, 9701n)).toBeNull();
  });

  it('takes winners at the close and holds losers only above the first price of the session', () => {
    expect(closeDecision(10000n, 10050n, 9900n)).toBe('SELL');
    expect(closeDecision(10000n, 9950n, 9900n)).toBe('HOLD');
    expect(closeDecision(10000n, 9850n, 9900n)).toBe('SELL');
    expect(closeDecision(10000n, 9950n, undefined)).toBe('SELL');
  });

  it('builds the watchlist from the strength band, largest traded value first', () => {
    const quote = (symbol: string, changeBps: bigint, volume: bigint) => ({ symbol, price: 10000n, changeBps, volume });
    expect(morningWatchlist([quote('A', 50n, 9n), quote('B', 300n, 5n), quote('C', 900n, 9n), quote('D', 100n, 7n), quote('E', 800n, 1n)]))
      .toEqual(['D', 'B', 'E']);
  });

  it('re-buys only 2% below the last sale', () => {
    expect(isRebuy(10000n, 9800n)).toBe(true);
    expect(isRebuy(10000n, 9801n)).toBe(false);
  });
});

describe('shadow ledger', () => {
  const trade = (side: 'BUY' | 'SELL', quantity: bigint, fillPrice: bigint, feesKrw: bigint, sessionDate = '20261008'): ShadowTrade =>
    ({ sessionDate, symbol: 'A', side, quantity, quotePrice: fillPrice, fillPrice, feesKrw, reason: 'x', createdAt: '' });

  it('replays cash, holdings and realized results with fees', () => {
    const result = replayShadow(500_000n, [trade('BUY', 10n, 10000n, 20n), trade('SELL', 4n, 10500n, 93n), trade('SELL', 6n, 9700n, 129n, '20261009')]);
    expect(result.cashKrw).toBe(500_000n - 100_020n + 41_907n + 58_071n);
    expect(result.holdings).toEqual([]);
    expect(result.days.get('20261008')).toEqual({ trades: 2, realizedKrw: 41_907n - 40_008n });
    expect(result.days.get('20261009')).toEqual({ trades: 1, realizedKrw: 58_071n - 60_012n });
  });

  it('refuses a sale of shares it does not hold', () => {
    expect(() => replayShadow(500_000n, [trade('SELL', 1n, 10000n, 0n)])).toThrow('shadow_ledger_inconsistent');
  });
});
