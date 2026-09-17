import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createOrderExecution } from './execute.ts';
import { createOrderReconciliation } from './reconcile.ts';
import { input, portfolio, position, setupOrders } from '../../../test/orderFixtures.ts';

it('BUY → partial SELL → FILLED records exact loss, aggregates one losing order, and blocks the next BUY', async () => {
  const s = setupOrders(); const execute = createOrderExecution(s.deps);
  const reconcile = createOrderReconciliation(s.repository, s.broker, s.account, s.deps.now);
  const buy = await execute(randomUUID(), { ...input, quantity: '4' });
  s.broker.getOrderFill.mockResolvedValue({ brokerOrderId: '12345', orderDate: '20260916', symbol: input.symbol, side: 'BUY',
    quantity: '4', filledQuantity: '4', filledAmount: '280000', status: 'FILLED' });
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [{ ...position, quantity: '4', availableQuantity: '4' }] });
  await reconcile(buy.id);
  s.broker.submitOrder.mockResolvedValue({ accepted: true, brokerOrderId: '12346' });
  const sell = await execute(randomUUID(), { ...input, side: 'SELL', quantity: '4' });
  s.broker.getOrderFill.mockResolvedValue({ brokerOrderId: '12346', orderDate: '20260916', symbol: input.symbol, side: 'SELL',
    quantity: '4', filledQuantity: '2', filledAmount: '20000', status: 'PARTIALLY_FILLED' });
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [{ ...position, quantity: '2' }] });
  await reconcile(sell.id); await reconcile(sell.id);
  expect(s.executions).toHaveLength(2);
  expect(await s.repository.getTradeLedger('20260916')).toMatchObject({ dailyRealizedPnl: '-120000', consecutiveLosses: 1 });
  s.broker.getOrderFill.mockResolvedValue({ brokerOrderId: '12346', orderDate: '20260916', symbol: input.symbol, side: 'SELL',
    quantity: '4', filledQuantity: '4', filledAmount: '40000', status: 'FILLED' });
  s.account.getPortfolio.mockResolvedValue(portfolio);
  await reconcile(sell.id); await reconcile(sell.id);
  expect(s.executions).toHaveLength(3);
  const rejected = await execute(randomUUID(), input);
  expect(rejected).toMatchObject({ brokerStatus: 'RISK_REJECTED', audit: { context: { dailyRealizedPnl: '-240000', consecutiveLosses: 1 } } });
  expect(rejected.riskReasons).toContain('DAILY_LOSS_LIMIT_EXCEEDED');
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(2);
});
it('a completely unfilled order creates no execution and still blocks another order', async () => {
  const s = setupOrders(); const execute = createOrderExecution(s.deps);
  const order = await execute(randomUUID(), input);
  s.broker.getOrderFill.mockResolvedValue({ brokerOrderId: '12345', orderDate: '20260916', symbol: input.symbol, side: 'BUY',
    quantity: '1', filledQuantity: '0', filledAmount: '0', status: 'SUBMITTED' });
  expect((await createOrderReconciliation(s.repository, s.broker, s.account)(order.id)).brokerStatus).toBe('SUBMITTED');
  expect(s.executions).toHaveLength(0);
  await expect(execute(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
});
it('ledger read failure and untracked holdings never reach the order broker', async () => {
  const s = setupOrders();
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [position] });
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).failureCode).toBe('invalid_context');
  s.repository.getTradeLedger = async () => { throw new Error('database unavailable'); };
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).failureCode).toBe('order_context_unavailable');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
