import { describe, expect, it, vi } from 'vitest';
import type { StoredOrder } from '../../domain/orders.ts';
import type { MomentumEvaluation } from '../../domain/strategy/momentum.ts';
import type { OrderServices } from '../orders/index.ts';
import { OrderError } from '../orders/ports.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import { createMomentumExecutor } from './momentumExecution.ts';
import { orderInputSchema } from '../orders/input.ts';

const context = { cash: '10000000', totalEquity: '10000000', dailyRealizedPnl: '0', openPositionCount: 1, consecutiveLosses: 0, killSwitchEnabled: false };
const signal = (symbol: string, side: 'BUY' | 'SELL', quantity: string, momentum: number, reason: MomentumEvaluation['reason']): MomentumEvaluation => ({
  strategyId: 'momentum-rotation', version: '1', symbol, evaluatedAt: '2026-10-06T06:30:00.000Z', source: 'fixture', reason,
  heldQuantity: side === 'SELL' ? quantity : '0', score: [momentum],
  metrics: { momentum, trendMa: 90000, close: '100000', rank: 0 },
  proposal: { symbol, side, quantity, estimatedPrice: '100000', confidence: '1', createdAt: '2026-10-06T06:30:00.000Z' } });
const run: StrategyRunRecord = { runKey: 'plan-momentum-20261007-abcdefabcdef', sessionDate: '20261007', createdAt: '2026-10-07T00:05:00.000Z',
  dataSha256: 'd'.repeat(64), result: { mode: 'paper', dataSha256: 'd'.repeat(64), configuration: {}, order: null,
    evaluations: [signal('000001', 'BUY', '5', 0.3, 'MOMENTUM_ENTRY'), signal('000002', 'SELL', '3', 0, 'TREND_EXIT'), signal('000003', 'BUY', '5', 0.5, 'MOMENTUM_ENTRY')]
      .map((s) => ({ signal: s, context, decision: null })) } } as unknown as StrategyRunRecord;
const order = (symbol: string, patch: Partial<StoredOrder> = {}) => ({ id: `o-${symbol}`, symbol, brokerStatus: 'FILLED',
  positionsSyncedAt: '2026-10-07T00:06:00.000Z', ...patch }) as StoredOrder;

function setup(submitImpl: (key: string, request: { symbol: string }) => Promise<StoredOrder>) {
  const submit = vi.fn(submitImpl);
  const reconcile = vi.fn(async (id: string) => order(id.slice(2)));
  const orders = { submit, reconcile, get: vi.fn() } as unknown as OrderServices;
  const isEnabled = vi.fn(async () => true);
  const execute = createMomentumExecutor({ plans: { latestPlanRun: async () => run }, orders, isEnabled, now: () => new Date('2026-10-07T00:10:00Z') });
  return { submit, reconcile, isEnabled, execute };
}

describe('momentum plan execution', () => {
  it('submits approved items sells first, then buys by momentum, with deterministic keys and provenance', async () => {
    const s = setup(async (_key, request) => order(request.symbol));
    expect(await s.execute()).toEqual({ status: 'done', submitted: 3, filled: 3, failed: 0 });
    expect(s.submit.mock.calls.map(([, request]) => request.symbol)).toEqual(['000002', '000003', '000001']);
    const [key, request] = s.submit.mock.calls[0]!;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(request).toMatchObject({ side: 'SELL', quantity: '3', orderType: 'MARKET', strategy: { strategyId: 'momentum-rotation',
      planRunKey: run.runKey, reason: 'TREND_EXIT', account: { heldQuantity: '3' } } });
    // The generated request is accepted by the real order input validation.
    for (const [, submitted] of s.submit.mock.calls) expect(orderInputSchema.safeParse(submitted).success).toBe(true);
    const keys = s.submit.mock.calls.map(([k]) => k);
    await s.execute();
    expect(s.submit.mock.calls.slice(3).map(([k]) => k)).toEqual(keys);
  });

  it('waits on an unsettled order after one reconciliation and resumes on the next call', async () => {
    const s = setup(async (_key, request) => request.symbol === '000002' ? order('000002', { brokerStatus: 'SUBMITTED', positionsSyncedAt: null }) : order(request.symbol));
    s.reconcile.mockResolvedValueOnce(order('000002', { brokerStatus: 'SUBMITTED', positionsSyncedAt: null }));
    expect(await s.execute()).toEqual({ status: 'pending', symbol: '000002' });
    expect(s.submit).toHaveBeenCalledTimes(1);
    expect(await s.execute()).toMatchObject({ status: 'done', filled: 3 });
  });

  it('halts on ambiguous broker state or an account conflict without sending more orders', async () => {
    const unknown = setup(async (_key, request) => order(request.symbol, { brokerStatus: 'UNKNOWN', positionsSyncedAt: null }));
    expect(await unknown.execute()).toEqual({ status: 'halted', symbol: '000002', reason: 'UNKNOWN' });
    expect(unknown.submit).toHaveBeenCalledTimes(1);
    const busy = setup(async () => { throw new OrderError('account_busy'); });
    expect(await busy.execute()).toEqual({ status: 'halted', symbol: '000002', reason: 'account_busy' });
  });

  it('records failed items and continues, and stops before new submissions when paused', async () => {
    const s = setup(async (_key, request) => request.symbol === '000003' ? order('000003', { brokerStatus: 'FAILED', positionsSyncedAt: null }) : order(request.symbol));
    expect(await s.execute()).toEqual({ status: 'done', submitted: 3, filled: 2, failed: 1 });
    const paused = setup(async (_key, request) => order(request.symbol));
    paused.isEnabled.mockResolvedValue(false);
    expect(await paused.execute()).toEqual({ status: 'paused' });
    expect(paused.submit).not.toHaveBeenCalled();
  });

  it('does nothing without a plan for today', async () => {
    const submit = vi.fn();
    const execute = createMomentumExecutor({ plans: { latestPlanRun: async () => run }, orders: { submit } as unknown as OrderServices,
      isEnabled: async () => true, now: () => new Date('2026-10-08T00:10:00Z') });
    expect(await execute()).toEqual({ status: 'no_plan' });
    expect(submit).not.toHaveBeenCalled();
  });
});
