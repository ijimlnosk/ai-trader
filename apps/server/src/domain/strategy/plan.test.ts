import { describe, expect, it } from 'vitest';
import type { RiskContext } from '../risk/index.ts';
import type { StrategyEvaluation } from './evaluate.ts';
import { planSession } from './plan.ts';

const context: RiskContext = { cash: '1000000', totalEquity: '10000000', dailyRealizedPnl: '0', openPositionCount: 3,
  consecutiveLosses: 0, killSwitchEnabled: false };
const ev = (symbol: string, side: 'BUY' | 'SELL' | null, quantity = '1', price = '100000', volumeRatio = 1.5, spread = 0.01): StrategyEvaluation => ({
  strategyId: 'ema-cross', version: '1', configId: 'c', symbol, evaluatedAt: '2026-09-29T06:30:00.000Z', source: 's',
  screen: { symbol, included: true, reasons: [], averageTurnover: '1' },
  indicators: { ema20: 100 * (1 + spread), ema60: 100, previousEma20: 99, previousEma60: 100, rsi14: 60, atr14: 1, volumeRatio, trend: 'up' },
  reason: side === 'BUY' ? 'BULLISH_CROSS' : side === 'SELL' ? 'TREND_EXIT' : 'NO_ENTRY',
  proposal: side ? { symbol, side, quantity, estimatedPrice: price, confidence: '1', createdAt: '2026-09-29T06:30:00.000Z' } : null,
});

describe('session plan', () => {
  it('sells first, then buys by volume ratio, spread and symbol', () => {
    const plan = planSession([ev('000001', 'BUY', '1', '100000', 1.3), ev('000002', null), ev('000003', 'SELL'),
      ev('000004', 'BUY', '1', '100000', 2.0), ev('000005', 'BUY', '1', '100000', 1.3, 0.05)], { ...context, openPositionCount: 1 });
    expect(plan.items.map((item) => [item.rank, item.symbol, item.side])).toEqual([[1, '000003', 'SELL'], [2, '000004', 'BUY'],
      [3, '000005', 'BUY'], [4, '000001', 'BUY']]);
    expect(plan.scanned).toBe(5);
    expect(plan.reasons).toEqual({ BULLISH_CROSS: 3, NO_ENTRY: 1, TREND_EXIT: 1 });
  });

  it('consumes cash and position slots from earlier approved buys, including the exact-cash boundary', () => {
    const plan = planSession([ev('000001', 'BUY', '4', '200000', 4), ev('000002', 'BUY', '3', '100000', 3),
      ev('000003', 'BUY', '2', '100000', 2), ev('000004', 'BUY', '1', '1', 1.5)], context);
    expect(plan.items.map((item) => item.decision.approved)).toEqual([true, false, true, false]);
    expect(plan.items[0]!.context).toEqual(context);
    expect(plan.items[1]!.context).toMatchObject({ cash: '200000', openPositionCount: 4 });
    expect(plan.items[1]!.decision.reasons).toContain('INSUFFICIENT_CASH');
    // Exactly the remaining cash is allowed.
    expect(plan.items[2]!.context).toMatchObject({ cash: '200000', openPositionCount: 4 });
    expect(plan.items[3]!.context).toMatchObject({ cash: '0', openPositionCount: 5 });
    expect(plan.items[3]!.decision.reasons).toContain('MAX_PORTFOLIO_POSITIONS_EXCEEDED');
  });

  it('does not treat sale proceeds as cash but frees a position slot', () => {
    const plan = planSession([ev('000009', 'SELL', '3', '50000'), ev('000001', 'BUY', '1', '100000')], { ...context, openPositionCount: 5 });
    expect(plan.items[1]!.context).toMatchObject({ cash: '1000000', openPositionCount: 4 });
    expect(plan.items[1]!.decision.approved).toBe(true);
  });

  it('is empty when no evaluation proposes a trade', () => {
    expect(planSession([ev('000001', null)], context).items).toEqual([]);
  });
});
