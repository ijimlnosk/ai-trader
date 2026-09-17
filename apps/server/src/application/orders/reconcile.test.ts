import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createOrderExecution } from './execute.ts';
import { createOrderReconciliation } from './reconcile.ts';
import { input, setupOrders, portfolio, position } from '../../../test/orderFixtures.ts';
import type { BrokerFill } from '../../domain/orders.ts';

it('UNKNOWN needs an operator-confirmed broker id and never submits another order', async () => {
  const s = setupOrders(); s.broker.submitOrder.mockRejectedValue(new Error('timeout'));
  const order = await createOrderExecution(s.deps)(randomUUID(), input);
  const reconcile = createOrderReconciliation(s.repository, s.broker, s.account, s.deps.now);
  await expect(reconcile(order.id)).rejects.toMatchObject({ code: 'reconciliation_required' });
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [position] });
  expect(await reconcile(order.id, '12345')).toMatchObject({ brokerStatus: 'FILLED', brokerOrderId: '12345' });
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
const invalidFills: Partial<BrokerFill>[] = [{ symbol: '000660' }, { side: 'SELL' }, { quantity: '2' }, { orderDate: '20260915' },
  { filledQuantity: '2' }, { filledAmount: '0' }, { filledQuantity: '0', filledAmount: '0' }];
it.each(invalidFills)('rejects mismatched or inconsistent fill %j', async (patch) => {
  const s = setupOrders(); const order = await createOrderExecution(s.deps)(randomUUID(), input);
  const fill = await s.broker.getOrderFill(order, '12345');
  s.broker.getOrderFill.mockResolvedValue({ ...fill!, ...patch });
  await expect(createOrderReconciliation(s.repository, s.broker, s.account)(order.id)).rejects.toMatchObject({ code: 'invalid_reconciliation' });
  expect((await s.repository.get(order.id))?.brokerStatus).toBe('SUBMITTED');
  expect(s.snapshots).toHaveLength(0);
});
it('provider failure leaves an unresolved order blocked without fabricated positions', async () => {
  const s = setupOrders(); const order = await createOrderExecution(s.deps)(randomUUID(), input);
  s.account.getPortfolio.mockRejectedValue(new Error('provider failure'));
  await expect(createOrderReconciliation(s.repository, s.broker, s.account)(order.id)).rejects.toThrow();
  expect(s.snapshots).toHaveLength(0);
  await expect(createOrderExecution(s.deps)(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
});
it('partial fills stay blocked; terminal replay cannot overwrite a later portfolio', async () => {
  const s = setupOrders(); const order = await createOrderExecution(s.deps)(randomUUID(), { ...input, quantity: '2' });
  s.broker.getOrderFill.mockResolvedValue({ brokerOrderId: '12345', orderDate: '20260916', symbol: '005930', side: 'BUY',
    quantity: '2', filledQuantity: '1', filledAmount: '70000', status: 'PARTIALLY_FILLED' });
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [position] });
  const reconcile = createOrderReconciliation(s.repository, s.broker, s.account, s.deps.now);
  expect((await reconcile(order.id)).positionsSyncedAt).toBeNull();
  await expect(createOrderExecution(s.deps)(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
  s.broker.getOrderFill.mockResolvedValue({ brokerOrderId: '12345', orderDate: '20260916', symbol: '005930', side: 'BUY',
    quantity: '2', filledQuantity: '1', filledAmount: '70000', status: 'CANCELLED' });
  expect((await reconcile(order.id)).positionsSyncedAt).not.toBeNull();
  s.account.getPortfolio.mockRejectedValue(new Error('must not re-read terminal order'));
  expect((await reconcile(order.id)).brokerStatus).toBe('CANCELLED');
  expect(s.snapshots).toHaveLength(2);
});

it('rejects same-quantity amount corrections and impossible partial states without changing the ledger', async () => {
  const s = setupOrders(); const order = await createOrderExecution(s.deps)(randomUUID(), { ...input, quantity: '2' });
  const fill: BrokerFill = { brokerOrderId: '12345', orderDate: '20260916', symbol: input.symbol, side: 'BUY',
    quantity: '2', filledQuantity: '1', filledAmount: '70000', status: 'PARTIALLY_FILLED' };
  s.broker.getOrderFill.mockResolvedValue(fill);
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [position] });
  const reconcile = createOrderReconciliation(s.repository, s.broker, s.account, s.deps.now);
  await reconcile(order.id);
  for (const patch of [{ filledAmount: '71000' }, { filledQuantity: '2', filledAmount: '140000' },
    { filledQuantity: '0', filledAmount: '0' }, { filledQuantity: '1.5', filledAmount: '105000' }]) {
    s.broker.getOrderFill.mockResolvedValue({ ...fill, ...patch });
    await expect(reconcile(order.id)).rejects.toMatchObject({ code: 'invalid_reconciliation' });
  }
  expect(s.executions).toHaveLength(1);
  expect((await s.repository.get(order.id))?.filledAmount).toBe('70000');
});
