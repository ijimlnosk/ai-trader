import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createApp } from './createApp.ts';
import { parseEnvironment } from './environment.ts';
import { createOrderServices } from '../application/orders/index.ts';
import { createPaperPortfolioRiskContextProvider } from '../application/paperRiskContext.ts';
import { setupOrders, input } from '../../test/orderFixtures.ts';

const apiToken = 'test-order-api-token-at-least-32-characters';
function setup() {
  const s = setupOrders();
  const app = createApp(parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost/test', ORDER_API_TOKEN: apiToken, PAPER_ORDER_EXECUTION_ENABLED: 'true' }),
    { checkConnection: async () => {} }, { marketBroker: s.market, accountBroker: s.account,
      riskContextProvider: createPaperPortfolioRiskContextProvider(s.account), orders: createOrderServices(s.deps) }, false);
  const headers = { authorization: `Bearer ${apiToken}`, 'idempotency-key': randomUUID() };
  return { ...s, app, headers };
}
it('POST -> risk -> broker -> stored order -> GET and idempotent replay', async () => {
  const s = setup();
  try {
    const result = await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: s.headers, payload: input });
    expect(result.statusCode).toBe(202);
    expect(result.json()).toMatchObject({ requestedPrice: '70000', brokerOrderId: '12345', brokerStatus: 'SUBMITTED' });
    const get = await s.app.inject({ url: result.headers.location!, headers: s.headers });
    expect(get.statusCode).toBe(200); expect(get.json()).toEqual(result.json());
    const replay = await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: { ...s.headers, 'idempotency-key': s.headers['idempotency-key'].toUpperCase() }, payload: input });
    expect(replay.json()).toEqual(result.json()); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
    expect(get.body).not.toContain('idempotencyKey'); expect(get.body).not.toContain('audit');
  } finally { await s.app.close(); }
});
it.each([
  { ...input, estimatedPrice: '1' }, { ...input, quantity: '0' }, { ...input, quantity: '-1' },
  { ...input, quantity: '0.5' }, { ...input, quantity: 1 }, { ...input, orderType: 'LIMIT' },
  { ...input, confidence: 'NaN' }, { ...input, symbol: '005930\n' },
])('rejects invalid or client-priced input %j before external calls', async (payload) => {
  const s = setup();
  try {
    const result = await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: s.headers, payload });
    expect(result.statusCode).toBe(400); expect(s.market.getQuote).not.toHaveBeenCalled();
    expect(s.broker.submitOrder).not.toHaveBeenCalled();
  } finally { await s.app.close(); }
});
it('requires both authorization and an idempotency key', async () => {
  const s = setup();
  try {
    expect((await s.app.inject({ method: 'POST', url: '/api/v1/orders', payload: input })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: { authorization: s.headers.authorization }, payload: input })).statusCode).toBe(400);
    expect(s.broker.submitOrder).not.toHaveBeenCalled();
  } finally { await s.app.close(); }
});
it('same key with different input returns 409 and unknown orders return 404', async () => {
  const s = setup();
  try {
    await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: s.headers, payload: input });
    expect((await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: s.headers, payload: { ...input, quantity: '2' } })).statusCode).toBe(409);
    expect((await s.app.inject({ url: `/api/v1/orders/${randomUUID()}`, headers: s.headers })).statusCode).toBe(404);
    expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
  } finally { await s.app.close(); }
});
