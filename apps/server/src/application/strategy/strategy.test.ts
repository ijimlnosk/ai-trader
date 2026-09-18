import { evaluateStrategy } from '../../domain/strategy/evaluate.ts';
import { expect, it } from 'vitest';
import { createStrategyService, strategyOrderKey } from './index.ts';
import { strategySetup } from '../../../test/strategySetup.ts';
import { createOrderServices } from '../orders/index.ts';
import { createPaperPortfolioRiskContextProvider } from '../paperRiskContext.ts';
import { candleTime } from '../../domain/strategy/marketData.ts';

it('defaults to evaluation only and uses real ledger-backed risk context', async () => {
  const s = strategySetup();
  const result = await s.evaluate(s.data);
  expect(result.evaluations.some((e) => e.signal.proposal?.side === 'BUY' && e.decision?.approved)).toBe(true);
  expect(result.order).toBeNull(); expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('passes an explicit signal through existing risk/execution with durable provenance and replay key', async () => {
  const s = strategySetup();
  const first = await s.evaluate(s.data, '005930');
  expect(first.order?.brokerStatus).toBe('SUBMITTED');
  const second = await s.evaluate(s.data, '005930');
  expect(second.order).toEqual(first.order);
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
  const stored = [...s.rows.values()][0]!;
  expect(stored.audit?.decision.approved).toBe(true);
  expect(stored.request.strategy).toMatchObject({ version: '1', reason: 'BULLISH_CROSS', dataSha256: first.dataSha256 });
  expect(stored.request.strategy?.indicators.trend).toBe('up');
  const provenance = stored.request.strategy!;
  const reconstructed = evaluateStrategy(stored.symbol, provenance.candles, provenance.account, provenance.source);
  expect(reconstructed.proposal?.quantity).toBe(stored.quantity);
  expect(reconstructed.indicators).toEqual(provenance.indicators);
  const evaluation = first.evaluations.find((e) => e.signal.symbol === '005930')!;
  expect(strategyOrderKey({ ...evaluation.signal, configId: 'changed' })).toBe(evaluation.orderKey);
  expect(strategyOrderKey({ ...evaluation.signal, proposal: { ...evaluation.signal.proposal!, side: 'SELL' } })).toBe(evaluation.orderKey);
});
it('cannot bypass an execution-time risk rejection or disabled execution', async () => {
  const s = strategySetup();
  s.broker.getBuyingPower.mockResolvedValue({ cash: '1', quantity: '100' });
  const result = await s.evaluate(s.data, '005930');
  expect(result.order?.brokerStatus).toBe('RISK_REJECTED');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
  const disabled = strategySetup();
  const evaluate = createStrategyService({ ...disabled.strategyDeps, orders: createOrderServices({ ...disabled.deps, enabled: false }) });
  await expect(evaluate(disabled.data, '005930')).rejects.toThrow('execution_disabled');
  expect(disabled.broker.submitOrder).not.toHaveBeenCalled();
});
it('rejects unavailable or inconsistent account context', async () => {
  const s = strategySetup();
  const unavailable = createStrategyService({ ...s.strategyDeps, risk: { getRiskContext: async () => null } });
  await expect(unavailable(s.data, '005930')).rejects.toThrow('order_context_unavailable');
  const mismatch = createStrategyService({ ...s.strategyDeps, risk: { getRiskContext: async () => ({ cash: '1', totalEquity: '1',
    dailyRealizedPnl: '0', openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: false }) } });
  await expect(mismatch(s.data)).rejects.toThrow('order_context_unavailable');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('rejects future, stale and non-next-weekday executions before broker submission', async () => {
  const s = strategySetup();
  for (const timestamp of [candleTime('20260915', 'open'), '2026-09-22T01:00:00.000Z', '2026-09-17T01:00:00.000Z']) {
    const evaluate = createStrategyService({ ...s.strategyDeps, now: () => new Date(timestamp) });
    await expect(evaluate(s.data, '005930')).rejects.toThrow('order_context_unavailable');
  }
  await expect(s.evaluate(s.data, '123456')).rejects.toThrow('order_context_unavailable');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('risk denial at evaluation does not invoke order execution', async () => {
  const s = strategySetup();
  const evaluate = createStrategyService({ ...s.strategyDeps,
    risk: createPaperPortfolioRiskContextProvider(s.account, s.repository, true, s.deps.now) });
  const result = await evaluate(s.data, '005930');
  expect(result.order).toBeNull();
  expect(result.evaluations.find((e) => e.signal.symbol === '005930')?.decision?.reasons).toContain('KILL_SWITCH_ENABLED');
  expect(s.rows.size).toBe(0); expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
