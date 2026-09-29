import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { paperLoopSetup } from '../../../test/paperLoopSetup.ts';
import { createPaperLoop } from './index.ts';
import { loopOrderKey } from './input.ts';
import { createStrategyService } from '../strategy/index.ts';
import { createPaperPortfolioRiskContextProvider } from '../paperRiskContext.ts';
import { createOrderServices } from '../orders/index.ts';

it('claims before strategy, submits once, and recovers without evaluating after a restart', async () => {
  const s = paperLoopSetup();
  s.broker.getOrderFill.mockResolvedValue(null);
  const strategy = vi.fn(async (...args: Parameters<typeof s.evaluate>) => {
    expect([...s.runs.values()][0]?.status).toBe('CLAIMED'); return s.evaluate(...args);
  });
  const tick = createPaperLoop({ ...s.loopDeps, strategy });
  const first = await tick(s.input);
  expect(first.status).toBe('TRACKING'); expect(first.order?.brokerStatus).toBe('SUBMITTED');
  const replay = await createPaperLoop({ ...s.loopDeps, strategy, enabled: false, executionEnabled: false })(s.input);
  expect(replay.order?.id).toBe(first.order?.id);
  expect(strategy).toHaveBeenCalledTimes(1); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('rejects a changed payload, session, provenance, or new key for the same bar', async () => {
  const s = paperLoopSetup(); await s.tick(s.input);
  for (const patch of [{ runKey: 'another' }, { dataRef: 'another' }, { sessionDate: '20260917',
    calendar: { ...s.input.calendar, sessions: [...s.data.sessions, '20260917'] } }]) {
    await expect(s.tick({ ...s.input, ...patch })).rejects.toMatchObject({ code: 'loop_conflict' });
  }
  const data = { ...s.data, source: 'changed' };
  await expect(s.tick({ ...s.input, data, dataSha256: createHash('sha256').update(JSON.stringify(data)).digest('hex') }))
    .rejects.toMatchObject({ code: 'loop_conflict' });
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('concurrent callers cannot evaluate or submit twice', async () => {
  const s = paperLoopSetup(); const strategy = vi.fn(s.evaluate);
  const tick = createPaperLoop({ ...s.loopDeps, strategy });
  await Promise.allSettled([tick(s.input), tick(s.input), tick(s.input)]);
  expect(strategy).toHaveBeenCalledTimes(1); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
describe('admission is fail closed', () => {
  it.each([{ enabled: false }, { executionEnabled: false }])('requires both opt-ins %j', async patch => {
    const s = paperLoopSetup();
    await expect(createPaperLoop({ ...s.loopDeps, ...patch })(s.input)).rejects.toMatchObject({ code: 'loop_disabled' });
    expect(s.runs.size).toBe(0); expect(s.broker.submitOrder).not.toHaveBeenCalled();
  });
  it.each(['2026-09-16T06:20:00Z', '2026-09-15T01:00:00Z', '2026-09-22T01:00:00Z'])('rejects closed/stale/future session %s', async time => {
    const s = paperLoopSetup();
    await expect(createPaperLoop({ ...s.loopDeps, now: () => new Date(time) })(s.input)).rejects.toThrow();
    expect(s.runs.size).toBe(0); expect(s.broker.submitOrder).not.toHaveBeenCalled();
  });
  it('rejects wrong digest, symbol, calendar and incomplete history', async () => {
    const s = paperLoopSetup();
    for (const input of [{ ...s.input, dataSha256: 'a'.repeat(64) }, { ...s.input, calendar: { ...s.input.calendar, sessions: s.data.sessions } },
      { ...s.input, data: { ...s.data, series: [{ ...s.data.series[0], symbol: '000660' }] } },
      { ...s.input, data: { ...s.data, sessions: s.data.sessions.slice(1) } }]) await expect(s.tick(input)).rejects.toThrow();
    expect(s.runs.size).toBe(0); expect(s.broker.submitOrder).not.toHaveBeenCalled();
  });
  it('blocks on another unresolved order before evaluation', async () => {
    const s = paperLoopSetup(); s.repo.hasUnresolvedOrder = async () => true;
    await expect(s.tick(s.input)).rejects.toMatchObject({ code: 'loop_busy' });
    expect(s.runs.size).toBe(0); expect(s.broker.submitOrder).not.toHaveBeenCalled();
  });
});
it('persists risk denial and replays it after the kill switch changes', async () => {
  const s = paperLoopSetup();
  const strategy = createStrategyService({ ...s.strategyDeps,
    risk: createPaperPortfolioRiskContextProvider(s.account, s.repository, true, s.deps.now) });
  const first = await createPaperLoop({ ...s.loopDeps, strategy })(s.input);
  expect(first.status).toBe('COMPLETE'); expect(first.result?.evaluations[0]?.decision?.reasons).toContain('KILL_SWITCH_ENABLED');
  expect(await s.tick(s.input)).toEqual(first); expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('preserves execution-time risk rechecks', async () => {
  const s = paperLoopSetup(); s.broker.getBuyingPower.mockResolvedValue({ cash: '1', quantity: '100' });
  const result = await s.tick(s.input);
  expect(result.order?.brokerStatus).toBe('RISK_REJECTED'); expect(result.status).toBe('COMPLETE');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('never expires or reclaims a crash after claim with no order', async () => {
  const s = paperLoopSetup();
  await s.repo.claim(s.input, loopOrderKey(s.input), '2020-01-01T00:00:00.000Z');
  const result = await s.tick(s.input);
  expect(result.status).toBe('CLAIMED'); expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('keeps PREPARING and lost broker acknowledgement halted, without retrying transport', async () => {
  const s = paperLoopSetup(); s.broker.submitOrder.mockRejectedValue(new Error('timeout'));
  const result = await s.tick(s.input);
  expect(result.status).toBe('HALTED'); expect(result.order?.brokerStatus).toBe('UNKNOWN');
  await s.tick(s.input); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
  expect(s.broker.getOrderFill).not.toHaveBeenCalled();
});
it('recovers an accepted order after a crash before loop linkage', async () => {
  const s = paperLoopSetup(); s.broker.getOrderFill.mockResolvedValue(null);
  await s.repo.claim(s.input, loopOrderKey(s.input), '2026-09-16T01:02:00.000Z');
  const submitted = await s.evaluate(s.data, '005930');
  const result = await s.tick(s.input);
  expect(result.order?.id).toBe(submitted.order?.id); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('a persistence failure after acceptance retains the claim and cannot submit again', async () => {
  const s = paperLoopSetup(); const update = s.repo.update;
  s.repo.update = async () => { throw new Error('db unavailable'); };
  await expect(s.tick(s.input)).rejects.toThrow();
  expect([...s.runs.values()][0]?.status).toBe('CLAIMED');
  s.repo.update = update; s.broker.getOrderFill.mockResolvedValue(null);
  await s.tick(s.input); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('a reconciliation deadline halts new polling but explicit order recovery remains available', async () => {
  const s = paperLoopSetup(); s.broker.getOrderFill.mockResolvedValue(null);
  await s.tick(s.input); const calls = s.broker.getOrderFill.mock.calls.length;
  const result = await createPaperLoop({ ...s.loopDeps, now: () => new Date('2026-09-16T01:03:00Z') })(s.input);
  expect(result.reason).toBe('reconciliation_deadline'); expect(result.status).toBe('HALTED');
  expect(s.broker.getOrderFill).toHaveBeenCalledTimes(calls);
  const orders = createOrderServices({ ...s.deps, enabled: false });
  await expect(orders.reconcile(result.order!.id)).rejects.toThrow('reconciliation_required');
  expect(s.broker.getOrderFill).toHaveBeenCalledTimes(calls + 1);
});

it('persists a natural HOLD without reserving an order', async () => {
  const s = paperLoopSetup();
  for (const bar of s.data.series[0]!.candles) Object.assign(bar, { open: '70000', high: '70000', low: '70000', close: '70000' });
  s.input.dataSha256 = createHash('sha256').update(JSON.stringify(s.data)).digest('hex');
  const first = await s.tick(s.input);
  expect(first.status).toBe('COMPLETE'); expect(first.result?.evaluations[0]?.signal.proposal).toBeNull();
  expect(await s.tick(s.input)).toEqual(first); expect(s.rows.size).toBe(0);
});
it('failure before reservation halts the claim; crash in PREPARING is never retried', async () => {
  const s = paperLoopSetup(); const strategy = vi.fn(async () => { throw new Error('before order'); });
  const tick = createPaperLoop({ ...s.loopDeps, strategy });
  expect((await tick(s.input)).status).toBe('HALTED');
  await tick(s.input); expect(strategy).toHaveBeenCalledTimes(1); expect(s.rows.size).toBe(0);
  const p = paperLoopSetup();
  const preparing = createPaperLoop({ ...p.loopDeps, strategy: async () => {
    await p.repository.reserve(loopOrderKey(p.input), { symbol: '005930', side: 'BUY', quantity: '1', confidence: '1', orderType: 'MARKET' });
    throw new Error('crash after reservation');
  } });
  expect((await preparing(p.input)).status).toBe('HALTED');
  await preparing(p.input); expect(p.broker.submitOrder).not.toHaveBeenCalled();
});
it('a failed claim never enters strategy or broker', async () => {
  const s = paperLoopSetup(); s.repo.claim = async () => { throw new Error('DB unavailable'); };
  await expect(s.tick(s.input)).rejects.toThrow(); expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('partial fills and terminal replay cannot duplicate ledger deltas or re-evaluate changed holdings', async () => {
  const s = paperLoopSetup(); const base = await s.account.getPortfolio(); let partial = true;
  s.broker.getOrderFill.mockImplementation(async order => {
    const filled = partial ? '1' : order.quantity;
    s.account.getPortfolio.mockResolvedValue({ ...base, positions: [{ symbol: '005930', name: 'fixture', quantity: filled,
      availableQuantity: filled, currentPrice: order.requestedPrice!, averagePrice: order.requestedPrice!,
      evaluationAmount: '1', profitLoss: '0', profitLossRate: '0' }] });
    return { brokerOrderId: order.brokerOrderId!, orderDate: order.brokerOrderDate!, symbol: order.symbol, side: order.side,
      quantity: order.quantity, filledQuantity: filled, filledAmount: (BigInt(filled) * BigInt(order.requestedPrice!)).toString(),
      status: partial ? 'PARTIALLY_FILLED' : 'FILLED' };
  });
  const first = await s.tick(s.input); expect(first.order?.brokerStatus).toBe('PARTIALLY_FILLED');
  await s.tick(s.input); expect(s.executions).toHaveLength(1);
  partial = false; const complete = await s.tick(s.input);
  expect(complete.status).toBe('COMPLETE'); expect(complete.order?.positionsSyncedAt).not.toBeNull();
  expect(s.executions).toHaveLength(2);
  s.account.getPortfolio.mockRejectedValue(new Error('later portfolio changed'));
  expect(await s.tick(s.input)).toEqual(complete);
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1); expect(s.executions).toHaveLength(2);
});
it('filled orders with delayed holdings remain blocking until an explicit subsequent tick observes synchronization', async () => {
  const s = paperLoopSetup(); const base = await s.account.getPortfolio();
  s.broker.getOrderFill.mockImplementation(async order => ({ brokerOrderId: order.brokerOrderId!, orderDate: order.brokerOrderDate!,
    symbol: order.symbol, side: order.side, quantity: order.quantity, filledQuantity: order.quantity,
    filledAmount: (BigInt(order.quantity) * BigInt(order.requestedPrice!)).toString(), status: 'FILLED' }));
  const first = await s.tick(s.input);
  expect(first.status).toBe('TRACKING'); expect(first.order?.positionsSyncedAt).toBeNull();
  s.account.getPortfolio.mockResolvedValue({ ...base, positions: [{ symbol: '005930', name: 'fixture', quantity: first.order!.quantity,
    availableQuantity: first.order!.quantity, averagePrice: first.order!.requestedPrice!, currentPrice: first.order!.requestedPrice!,
    evaluationAmount: '1', profitLoss: '0', profitLossRate: '0' }] });
  expect((await s.tick(s.input)).status).toBe('COMPLETE'); expect(s.executions).toHaveLength(1);
});
it('a valid SELL still follows risk and execution with the BUY kill switch set', async () => {
  const s = paperLoopSetup(); const base = await s.account.getPortfolio();
  Object.assign(s.data.series[0]!.candles.at(-1)!, { open: '1000', high: '1000', low: '1000', close: '1000' });
  s.input.dataSha256 = createHash('sha256').update(JSON.stringify(s.data)).digest('hex');
  s.executions.push({ orderId: 'fixture-buy', symbol: '005930', side: 'BUY', quantity: '1', amount: '70000', tradeDate: '20260915' });
  s.account.getPortfolio.mockResolvedValue({ ...base, positions: [{ symbol: '005930', name: 'fixture', quantity: '1', availableQuantity: '1',
    averagePrice: '70000', currentPrice: '1000', evaluationAmount: '1000', profitLoss: '-69000', profitLossRate: '-98' }] });
  s.broker.getOrderFill.mockResolvedValue(null);
  const orders = createOrderServices({ ...s.deps, killSwitchEnabled: true });
  const strategy = createStrategyService({ ...s.strategyDeps, orders,
    risk: createPaperPortfolioRiskContextProvider(s.account, s.repository, true, s.deps.now) });
  const run = await createPaperLoop({ ...s.loopDeps, strategy, orders })(s.input);
  expect(run.order?.side).toBe('SELL'); expect(run.order?.riskStatus).toBe('approved');
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
