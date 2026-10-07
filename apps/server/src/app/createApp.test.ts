import { expect, it } from 'vitest';
import { createRuntimeApp } from './createRuntimeApp.ts';
import { parseEnvironment } from './environment.ts';

const environment = parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost:5432/test' });
it('health responds with actual paper adapter mode and connected database', async () => {
  const app = createRuntimeApp(environment, { checkConnection: async () => {} }, false);
  try {
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', database: 'connected', tradingMode: 'paper' });
  } finally { await app.close(); }
});
it('health fails closed and never leaks database errors', async () => {
  const app = createRuntimeApp(environment, { checkConnection: async () => { throw new Error('postgresql://secret:password@db/db'); } }, false);
  try {
    const response = await app.inject('/health');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'error', database: 'disconnected', tradingMode: 'paper' });
    expect(response.body).not.toContain('password');
  } finally { await app.close(); }
});
it.each([false, true])('rejects unsupported live broker, even with opt-in=%s', (enabled) => {
  expect(() => createRuntimeApp({ ...environment, BROKER_MODE: 'live', LIVE_TRADING_ENABLED: enabled }, { checkConnection: async () => {} }, false)).toThrow('Live broker is not implemented');
});
it('exposes no order endpoint', async () => {
  const app = createRuntimeApp(environment, { checkConnection: async () => {} }, false);
  try { expect((await app.inject({ method: 'POST', url: '/orders' })).statusCode).toBe(404); }
  finally { await app.close(); }
});
it('refuses a daily schedule without its persistence dependencies', () => {
  expect(() => createRuntimeApp({ ...environment, MARKET_DATA_SCHEDULE_ENABLED: true }, { checkConnection: async () => {} }, false))
    .toThrow('Daily schedule dependencies required');
});
it('refuses the take-profit dry run without its signal repository and starts with it', async () => {
  const enabled = { ...environment, INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED: true };
  expect(() => createRuntimeApp(enabled, { checkConnection: async () => {} }, false)).toThrow('Intraday signal repository required');
  const app = createRuntimeApp(enabled, { checkConnection: async () => {} }, false, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { record: async () => true });
  await app.close();
});
it('refuses the disclosure schedule without its repository', () => {
  expect(() => createRuntimeApp({ ...environment, DISCLOSURE_SCHEDULE_ENABLED: true, DART_API_KEY: 'k' }, { checkConnection: async () => {} }, false))
    .toThrow('Disclosure schedule dependencies required');
});
it('refuses virtual day trading without its trade repository', () => {
  expect(() => createRuntimeApp({ ...environment, SHADOW_DAY_TRADING_ENABLED: true }, { checkConnection: async () => {} }, false))
    .toThrow('Shadow day-trading dependencies required');
});
