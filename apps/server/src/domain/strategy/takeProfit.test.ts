import { describe, expect, it } from 'vitest';
import { gainBps, hasReachedTakeProfit } from './takeProfit.ts';

describe('take profit threshold', () => {
  it('computes floored basis points of gain', () => {
    expect(gainBps('229750.0000', '298675')).toBe(3000n);
    expect(gainBps('229750', '298674')).toBe(2999n);
    expect(gainBps('100', '99.99')).toBe(-1n);
  });

  it('triggers at exactly 30%, not below', () => {
    expect(hasReachedTakeProfit('100000', '130000')).toBe(true);
    expect(hasReachedTakeProfit('100000', '129999')).toBe(false);
    expect(hasReachedTakeProfit('100000', '200000')).toBe(true);
  });

  it.each([['0', '100'], ['100', '0'], ['-1', '100'], ['abc', '100'], ['100', ''], ['1e3', '2000']])(
    'never triggers on invalid prices %s / %s', (average, price) => {
      expect(gainBps(average, price)).toBeNull();
      expect(hasReachedTakeProfit(average, price)).toBe(false);
    });
});
