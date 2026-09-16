import { expect, it, vi } from 'vitest';
import { createApp } from './createApp.ts';
import { parseEnvironment } from './environment.ts';
import type { RiskContext } from '../domain/risk/index.ts';

const environment = parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost/test' });
const database = { checkConnection: async () => {} };
const input = { symbol: '005930', side: 'BUY', quantity: '10', estimatedPrice: '70000', confidence: '0.82' };
const context: RiskContext = { cash: '1000000', totalEquity: '7000000', dailyRealizedPnl: '0', openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: false };
const unusedBrokers = {
  marketBroker: { getQuote: vi.fn(), isConfigured: () => false },
  accountBroker: { getPortfolio: vi.fn() },
};
it.each([false, true])('registered endpoint returns only a decision; kill switch %s', async (killSwitchEnabled) => {
  const getPortfolio = vi.fn(); const getQuote = vi.fn();
  const app = createApp(environment, database, {
    marketBroker: { getQuote, isConfigured: () => false }, accountBroker: { getPortfolio },
    riskContextProvider: { getRiskContext: async () => ({ ...context, killSwitchEnabled }) },
  }, false);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual(killSwitchEnabled
      ? { approved: false, approvedQuantity: '0', reasons: ['KILL_SWITCH_ENABLED'] }
      : { approved: true, approvedQuantity: '10', reasons: [] });
    expect(getPortfolio).not.toHaveBeenCalled(); expect(getQuote).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
it('explicit unavailable test provider fails closed', async () => {
  const app = createApp(environment, database, {
    ...unusedBrokers, riskContextProvider: { getRiskContext: async () => null },
  }, false);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approved: false, approvedQuantity: '0', reasons: ['INVALID_CONTEXT'] });
  } finally { await app.close(); }
});
it.each([{ ...input, quantity: 10 }, { ...input, confidence: null }, { symbol: '005930' }, { ...input, context }, { ...input, policy: {} }, { ...input, side: 'HOLD' }])('rejects malformed HTTP input before context lookup %j', async (payload) => {
  const getRiskContext = vi.fn(async () => context);
  const app = createApp(environment, database, { ...unusedBrokers, riskContextProvider: { getRiskContext } }, false);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload });
    expect(response.statusCode).toBe(400); expect(getRiskContext).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
it('returns INVALID_PROPOSAL for semantically invalid financial strings', async () => {
  const app = createApp(environment, database, { ...unusedBrokers, riskContextProvider: { getRiskContext: async () => context } }, false);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: { ...input, quantity: '0' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().reasons).toEqual(['INVALID_PROPOSAL']);
  } finally { await app.close(); }
});
it('sanitizes context failure without exposing state or secrets', async () => {
  const logs: string[] = [];
  const app = createApp(environment, database, {
    ...unusedBrokers,
    riskContextProvider: { getRiskContext: async () => { throw new Error('fixture-private-account-secret'); } },
  }, { write: (chunk) => { logs.push(chunk); } });
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('risk_context_unavailable');
    expect(response.body + logs.join('')).not.toContain('fixture-private-account-secret');
  } finally { await app.close(); }
});
it('requires a risk provider at construction rather than silently installing a null provider', () => {
  // @ts-expect-error Exercise a missing provider from an untyped caller as well as the type contract.
  expect(() => createApp(environment, database, unusedBrokers, false)).toThrow('RiskContextProvider is required');
});
