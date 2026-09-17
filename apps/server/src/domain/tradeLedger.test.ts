import { expect, it } from 'vitest';
import { calculateTradeLedger, executionDelta, ledgerDecimal, type LedgerExecution } from './tradeLedger.ts';

const event = (orderId: string, side: 'BUY' | 'SELL', quantity: string, amount: string, tradeDate = '20260916'): LedgerExecution =>
  ({ orderId, symbol: '005930', side, quantity, amount, tradeDate });
it('an empty observed ledger has zero realized history', () => {
  expect(calculateTradeLedger([], '20260916')).toEqual({ dailyRealizedPnl: '0', consecutiveLosses: 0, positions: [] });
});
it('uses weighted purchase cost and realizes only sold shares, preserving residual basis', () => {
  const rows = [event('b1', 'BUY', '2', '140000'), event('b2', 'BUY', '1', '80000'), event('s1', 'SELL', '1', '70000')];
  expect(calculateTradeLedger(rows, '20260916')).toEqual({ dailyRealizedPnl: '-3333.33333333', consecutiveLosses: 1,
    positions: [{ symbol: '005930', quantity: '2', costAmount: '146666.66666667' }] });
  expect(calculateTradeLedger([...rows, event('s2', 'SELL', '2', '150000')], '20260916'))
    .toEqual({ dailyRealizedPnl: '0', consecutiveLosses: 0, positions: [] });
});
it('counts net SELL orders once across partial fills, not each execution or BUY', () => {
  const rows = [event('b1', 'BUY', '5', '500'), event('s1', 'SELL', '1', '90'), event('s1', 'SELL', '1', '90'),
    event('b2', 'BUY', '1', '100'), event('s2', 'SELL', '1', '90'), event('s3', 'SELL', '1', '90')];
  expect(calculateTradeLedger(rows, '20260916')).toMatchObject({ dailyRealizedPnl: '-40', consecutiveLosses: 3 });
  expect(calculateTradeLedger([...rows, event('s4', 'SELL', '1', '100')], '20260916').consecutiveLosses).toBe(0);
  expect(calculateTradeLedger([...rows, event('s3', 'SELL', '1', '120')], '20260916').consecutiveLosses).toBe(0);
});
it('daily P/L rolls over at the requested trading day; losses persist across days', () => {
  const rows = [event('b', 'BUY', '3', '300', '20260915'), event('s', 'SELL', '1', '90', '20260915'), event('s2', 'SELL', '1', '80')];
  expect(calculateTradeLedger(rows, '20260916')).toMatchObject({ dailyRealizedPnl: '-20', consecutiveLosses: 2 });
  expect(calculateTradeLedger(rows, '20260917')).toMatchObject({ dailyRealizedPnl: '0', consecutiveLosses: 2 });
});
it('never substitutes a quote or broker valuation for missing acquisition cost', () => {
  expect(() => calculateTradeLedger([event('s', 'SELL', '1', '70000')], '20260916')).toThrow('Missing ledger cost basis');
});
it.each([
  event('x', 'BUY', '0', '1'), event('x', 'BUY', '0.5', '1'), event('x', 'BUY', '1', '0'),
  event('x', 'BUY', '1', 'NaN'), event('x', 'BUY', '1', '1', '20260230'), event('x', 'BUY', '1', '1', '20260917'),
])('rejects malformed or future execution %j', (row) => {
  expect(() => calculateTradeLedger([row], '20260916')).toThrow();
});
it('rejects reordered history or interleaved order identities', () => {
  expect(() => calculateTradeLedger([event('b', 'BUY', '1', '1'), event('b2', 'BUY', '1', '1', '20260915')], '20260916')).toThrow();
  expect(() => calculateTradeLedger([event('b', 'BUY', '1', '1'), event('b2', 'BUY', '1', '1'), event('b', 'BUY', '1', '1')], '20260916')).toThrow();
});
it('preserves exact amounts beyond Number safe integer and bounds persisted decimals', () => {
  expect(calculateTradeLedger([event('b', 'BUY', '1', '9007199254740993.12345678'),
    event('s', 'SELL', '1', '9007199254740993.12345679')], '20260916').dailyRealizedPnl).toBe('0.00000001');
  expect(() => ledgerDecimal(10n ** 24n)).toThrow();
});
it('derives only positive incremental fills and treats repeated cumulative snapshots as no-ops', () => {
  expect(executionDelta('0', '0', '1', '70000')).toEqual({ quantity: '1', amount: '70000' });
  expect(executionDelta('1', '70000', '3', '220000')).toEqual({ quantity: '2', amount: '150000' });
  expect(executionDelta('1', '70000', '1.00000000', '70000.00000000')).toBeNull();
});
it.each([['1', '101'], ['2', '100'], ['0', '0'], ['1.5', '150']])('rejects non-monotonic/inconsistent cumulative change %s/%s', (qty, amount) => {
  expect(() => executionDelta('1', '100', qty, amount)).toThrow();
});
