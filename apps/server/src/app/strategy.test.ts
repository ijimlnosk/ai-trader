import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from './createApp.ts';
import { parseEnvironment } from './environment.ts';
import { strategySetup } from '../../test/strategySetup.ts';
import { time } from '../../test/orderFixtures.ts';
const token = 'test-order-api-token-at-least-32-characters';
afterEach(() => { vi.useRealTimers(); });
function setup() {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(time));
  const s = strategySetup();
  const app = createApp(parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost/test', ORDER_API_TOKEN: token,
    PAPER_ORDER_EXECUTION_ENABLED: 'true' }), { checkConnection: async () => {} },
  { marketBroker: s.market, accountBroker: s.account, riskContextProvider: s.strategyDeps.risk, orders: s.strategyDeps.orders }, false);
  return { ...s, app, headers: { authorization: `Bearer ${token}` } };
}
it('protects strategy endpoint and defaults to read-only evaluation', async () => {
  const s = setup();
  try {
    expect((await s.app.inject({ method: 'POST', url: '/api/v1/strategy/evaluate', payload: { data: s.data } })).statusCode).toBe(401);
    const result = await s.app.inject({ method: 'POST', url: '/api/v1/strategy/evaluate', headers: s.headers, payload: { data: s.data } });
    expect(result.statusCode).toBe(200); expect(result.json().order).toBeNull();
    expect(result.json().evaluations).toHaveLength(2); expect(s.broker.submitOrder).not.toHaveBeenCalled();
  } finally { await s.app.close(); }
});
it('explicit paper execution uses a deterministic key across repeated HTTP requests', async () => {
  const s = setup();
  try {
    const request = { method: 'POST' as const, url: '/api/v1/strategy/evaluate', headers: s.headers,
      payload: { data: s.data, executeSymbol: '005930' } };
    const first = await s.app.inject(request); const second = await s.app.inject(request);
    expect(first.statusCode).toBe(200); expect(first.json().order.brokerStatus).toBe('SUBMITTED');
    expect(second.json().order).toEqual(first.json().order); expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
  } finally { await s.app.close(); }
});
it('rejects caller-supplied strategy overrides and malformed data without submitting', async () => {
  const s = setup();
  try {
    const malformed = structuredClone(s.data); malformed.series[0]!.candles[0]!.high = '1';
    for (const payload of [{ data: malformed }, { data: s.data, config: { minRsi: 0 } }, { data: { ...s.data, timezone: 'UTC' } }]) {
      const result = await s.app.inject({ method: 'POST', url: '/api/v1/strategy/evaluate', headers: s.headers, payload });
      expect(result.statusCode).toBe(400);
    }
    expect(s.broker.submitOrder).not.toHaveBeenCalled();
  } finally { await s.app.close(); }
});
