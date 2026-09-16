import { randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createOrderExecution } from './execute.ts';
import { createOrderReconciliation } from './reconcile.ts';
import { setupOrders, input, position, portfolio, time } from '../../../test/orderFixtures.ts';

it('persists approved risk and SUBMITTING before one server-priced broker order; replays only read', async () => {
  const s = setupOrders(); const key = randomUUID();
  s.broker.submitOrder.mockImplementation(async (request) => {
    expect([...s.rows.values()][0]).toMatchObject({ brokerStatus: 'SUBMITTING', riskStatus: 'approved', requestedPrice: '70000' });
    expect(request).toMatchObject({ symbol: '005930', quantity: '1', side: 'BUY', orderType: 'MARKET' });
    return { accepted: true, brokerOrderId: '12345' };
  });
  const execute = createOrderExecution(s.deps);
  const order = await execute(key, input);
  expect(order).toMatchObject({ brokerStatus: 'SUBMITTED', brokerOrderId: '12345', riskStatus: 'approved' });
  expect(order.audit?.proposal.estimatedPrice).toBe('70000');
  expect(await execute(key, input)).toEqual(order);
  expect(s.market.getQuote).toHaveBeenCalledTimes(1); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('serializes simultaneous different keys, and same-key replay cannot submit twice', async () => {
  const s = setupOrders(); const execute = createOrderExecution(s.deps); const key = randomUUID();
  await Promise.all([execute(key, input), execute(key, input)]);
  await expect(execute(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
  await expect(execute(key, { ...input, quantity: '2' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it.each(['timeout', 'malformed_receipt'])('ambiguous %s persists UNKNOWN and blocks resubmission even after service recreation', async (reason) => {
  const s = setupOrders(); const key = randomUUID();
  s.broker.submitOrder.mockRejectedValue(new Error(reason));
  expect((await createOrderExecution(s.deps)(key, input)).brokerStatus).toBe('UNKNOWN');
  expect((await createOrderExecution(s.deps)(key, input)).brokerStatus).toBe('UNKNOWN');
  await expect(createOrderExecution(s.deps)(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('risk rejection is saved without broker submission', async () => {
  const s = setupOrders();
  const order = await createOrderExecution(s.deps)(randomUUID(), { ...input, confidence: '0.69' });
  expect(order).toMatchObject({ brokerStatus: 'RISK_REJECTED', riskStatus: 'rejected', riskReasons: ['CONFIDENCE_TOO_LOW'] });
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('kill switch blocks BUY and preserves risk reason', async () => {
  const s = setupOrders(); s.deps.killSwitchEnabled = true;
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).riskReasons).toContain('KILL_SWITCH_ENABLED');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it.each(['invalid', '2026-09-16T00:59:49.000Z', '2026-09-16T01:00:01.000Z'])('rejects stale/invalid quote timestamp %s', async (timestamp) => {
  const s = setupOrders(); s.market.getQuote.mockResolvedValue({ symbol: '005930', price: '70000', change: '0', changeRate: '0', volume: '1', timestamp });
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).failureCode).toBe('invalid_quote');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('rechecks freshness after buying power/risk persistence', async () => {
  const s = setupOrders();
  let clock = new Date(time); s.deps.now = () => clock;
  s.broker.getBuyingPower.mockImplementation(async () => { clock = new Date(Date.parse(time) + 11_000); return { cash: '10000000', quantity: '100' }; });
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).failureCode).toBe('quote_or_session_expired');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('provider failure before submit fails closed', async () => {
  const s = setupOrders(); s.account.getPortfolio.mockRejectedValue(new Error('private-secret'));
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).failureCode).toBe('order_context_unavailable');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('persist failure after broker acceptance leaves durable SUBMITTING and replay cannot resend', async () => {
  const s = setupOrders(); const update = s.repository.update; const key = randomUUID();
  s.repository.update = vi.fn(async (order, patch) => {
    if (patch.brokerStatus === 'SUBMITTED') throw new Error('db down');
    return update(order, patch);
  });
  await expect(createOrderExecution(s.deps)(key, input)).rejects.toThrow('db down');
  expect((await createOrderExecution(s.deps)(key, input)).brokerStatus).toBe('SUBMITTING');
  expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
});
it('DB failure before sending never sends', async () => {
  const s = setupOrders(); s.repository.update = vi.fn().mockRejectedValue(new Error('db down'));
  await expect(createOrderExecution(s.deps)(randomUUID(), input)).rejects.toThrow();
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it.each(['0', 'NaN'])('invalid/insufficient buying quantity %s never sends', async (quantity) => {
  const s = setupOrders(); s.broker.getBuyingPower.mockResolvedValue({ cash: '10000000', quantity });
  expect((await createOrderExecution(s.deps)(randomUUID(), input)).brokerStatus).toBe('FAILED');
  expect(s.broker.submitOrder).not.toHaveBeenCalled();
});
it('SELL requires sellable holdings; a valid liquidation can pass the BUY kill switch', async () => {
  const s = setupOrders(); const execute = createOrderExecution(s.deps);
  expect((await execute(randomUUID(), { ...input, side: 'SELL' })).failureCode).toBe('insufficient_sellable_quantity');
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [position] }); s.deps.killSwitchEnabled = true;
  expect((await execute(randomUUID(), { ...input, side: 'SELL' })).brokerStatus).toBe('SUBMITTED');
  expect(s.broker.getBuyingPower).not.toHaveBeenCalled();
});
it('confirmed fill and broker holdings release the account for another candidate', async () => {
  const s = setupOrders(); const execute = createOrderExecution(s.deps);
  const order = await execute(randomUUID(), input);
  const reconcile = createOrderReconciliation(s.repository, s.broker, s.account, s.deps.now);
  expect((await reconcile(order.id)).positionsSyncedAt).toBeNull(); // Broker balance has not caught up.
  await expect(execute(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
  s.account.getPortfolio.mockResolvedValue({ ...portfolio, positions: [position] });
  expect(await reconcile(order.id)).toMatchObject({ brokerStatus: 'FILLED', filledQuantity: '1', positionsSyncedAt: time });
  expect((await execute(randomUUID(), input)).brokerStatus).toBe('SUBMITTED');
});
