import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { createRuntimeApp } from './createRuntimeApp.ts';
import { parseEnvironment } from './environment.ts';
import { setupOrders, input, time } from '../../test/orderFixtures.ts';

const token = 'fixture-order-api-token-at-least-32-characters';
const config = { DATABASE_URL: 'postgresql://test:test@localhost/test', KIS_APP_KEY: 'fixture-key',
  KIS_APP_SECRET: 'fixture-secret', KIS_ACCOUNT_NO: '12345678', KIS_ACCOUNT_PRODUCT_CODE: '01',
  PAPER_ORDER_EXECUTION_ENABLED: 'true', ORDER_API_TOKEN: token };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('production composition persists risk before the real paper adapter POST and supports lookup', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(time));
  const s = setupOrders();
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    const path = new URL(String(url)).pathname;
    let body: unknown;
    if (path === '/oauth2/tokenP') body = { access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 };
    else if (path.endsWith('/inquire-psbl-order')) body = { rt_cd: '0', output: { nrcvb_buy_amt: '10000000', nrcvb_buy_qty: '100' } };
    else if (path.endsWith('/order-cash')) {
      expect([...s.rows.values()][0]).toMatchObject({ riskStatus: 'approved', brokerStatus: 'SUBMITTING' });
      expect(init?.headers).toMatchObject({ tr_id: 'VTTC0012U' });
      body = { rt_cd: '0', output: { ODNO: '12345', KRX_FWDG_ORD_ORGNO: '00950', ORD_TMD: '100000' } };
    } else throw new Error('Unexpected request');
    return new Response(JSON.stringify(body));
  });
  vi.stubGlobal('fetch', fetcher);
  const app = createRuntimeApp(parseEnvironment(config), { checkConnection: async () => {} }, false, s.market, s.account, s.repository);
  const headers = { authorization: `Bearer ${token}`, 'idempotency-key': randomUUID() };
  try {
    const result = await app.inject({ method: 'POST', url: '/api/v1/orders', headers, payload: input });
    expect(result.statusCode).toBe(202);
    expect(result.json()).toMatchObject({ brokerStatus: 'SUBMITTED', brokerOrderId: '12345', requestedPrice: '70000' });
    expect((await app.inject({ url: result.headers.location!, headers })).json()).toEqual(result.json());
    await app.inject({ method: 'POST', url: '/api/v1/orders', headers, payload: input });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/order-cash'))).toHaveLength(1);
  } finally { await app.close(); }
});
it('enabled production requires a repository; disabled defaults cannot execute', async () => {
  expect(() => createRuntimeApp(parseEnvironment(config), { checkConnection: async () => {} }, false)).toThrow('OrderRepository');
  const app = createRuntimeApp(parseEnvironment({ DATABASE_URL: config.DATABASE_URL }), { checkConnection: async () => {} }, false);
  try {
    expect((await app.inject({ method: 'POST', url: '/api/v1/orders', payload: input })).json()).toEqual({ error: { code: 'execution_disabled' } });
  } finally { await app.close(); }
});
it.each([undefined, 'short'])('execution requires an explicit long API token (%s)', (ORDER_API_TOKEN) => {
  expect(() => parseEnvironment({ ...config, ORDER_API_TOKEN })).toThrow('ORDER_API_TOKEN');
});
