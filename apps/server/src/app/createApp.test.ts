import { expect, it } from 'vitest';
import { createApp } from './createApp.ts';
import { parseEnvironment } from './environment.ts';

const environment = parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost:5432/test' });
it('health responds with actual paper adapter mode and connected database', async () => {
  const app = createApp(environment, { checkConnection: async () => {} }, false);
  try {
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'connected', tradingMode: 'paper' });
  } finally { await app.close(); }
});
it('health fails closed and never leaks database errors', async () => {
  const app = createApp(environment, { checkConnection: async () => { throw new Error('postgresql://secret:password@db/db'); } }, false);
  try {
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error', database: 'disconnected', tradingMode: 'paper' });
    expect(response.body).not.toContain('password');
  } finally { await app.close(); }
});
it.each([false, true])('rejects unsupported live broker, even with opt-in=%s', (enabled) => {
  expect(() => createApp({ ...environment, BROKER_MODE: 'live', LIVE_TRADING_ENABLED: enabled }, { checkConnection: async () => {} }, false)).toThrow('Live broker is not implemented');
});
it('exposes no order endpoint', async () => {
  const app = createApp(environment, { checkConnection: async () => {} }, false);
  try { expect((await app.inject({ method: 'POST', url: '/orders' })).statusCode).toBe(404); }
  finally { await app.close(); }
});
