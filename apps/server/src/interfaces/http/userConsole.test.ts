import { expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.ts';
import { parseEnvironment } from '../../app/environment.ts';
import { authSetup } from '../../../test/authSetup.ts';

function setup() {
  const s = authSetup();
  const portfolio = vi.fn(async () => ({ cash: '100', totalEvaluation: '100', totalPurchaseAmount: '0', totalProfitLoss: '0', totalProfitLossRate: '0', positions: [] }));
  const listOrders = vi.fn(async () => []);
  const app = createApp(parseEnvironment({ DATABASE_URL: 'postgres://test:test@localhost/test', CONSOLE_READ_TOKEN: 'r'.repeat(32), ORDER_API_TOKEN: 'o'.repeat(32) }),
    { checkConnection: async () => {} }, { orders: { submit: vi.fn(), get: vi.fn(), reconcile: vi.fn() }, auth: s.auth, executionAccount: 'account-a',
      consoleRead: { listOrders, listLoopRuns: async () => [], listSnapshots: async () => [], latestPlanRun: async () => null },
      marketBroker: { isConfigured: () => false, getQuote: vi.fn() }, accountBroker: { getPortfolio: portfolio },
      insightsRead: { dailyCoverage: async () => [], minuteCoverage: async () => [], recentDisclosures: async () => [], recentTakeProfit: async () => [] },
      riskContextProvider: { getRiskContext: vi.fn() } }, false);
  return { ...s, app, portfolio, listOrders };
}
it('owner session reads its account, while other/unlinked users cannot reach repositories or broker', async () => {
  const s = setup();
  try {
    const login = await s.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: s.credentials });
    expect(login.statusCode).toBe(200);
    const headers = { authorization: `Bearer ${login.json().token}` };
    expect((await s.app.inject({ url: '/api/v1/auth/me', headers })).json().user.hasTradingAccount).toBe(true);
    expect((await s.app.inject({ url: '/api/v1/me/console/orders', headers })).statusCode).toBe(200);
    expect((await s.app.inject({ url: '/api/v1/me/console/portfolio', headers })).statusCode).toBe(200);
    const insights = await s.app.inject({ url: '/api/v1/me/console/insights', headers });
    expect(insights.statusCode).toBe(200);
    expect(insights.json()).toEqual({ momentum: null, collection: { daily: [], minute: [] }, disclosures: [], takeProfit: [] });
    s.portfolio.mockClear(); s.listOrders.mockClear();
    for (const account of ['account-b', null]) {
      for (const identity of s.sessions.values()) identity.executionAccount = account;
      for (const name of ['orders', 'portfolio', 'loop-runs', 'snapshots', 'status', 'health', 'broker-status', 'insights']) {
        const response = await s.app.inject({ url: `/api/v1/me/console/${name}?executionAccount=account-a`, headers });
        expect(response.statusCode).toBe(403);
        expect(response.headers['cache-control']).toBe('no-store');
      }
    }
    expect(s.portfolio).not.toHaveBeenCalled(); expect(s.listOrders).not.toHaveBeenCalled();
    await s.app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers });
    expect((await s.app.inject({ url: '/api/v1/auth/me', headers })).statusCode).toBe(401);
  } finally { await s.app.close(); }
});
it('protects legacy endpoints, rejects machine tokens on user endpoints and rejects sessions on order endpoints', async () => {
  const s = setup();
  try {
    const { token } = await s.auth.login(s.credentials);
    for (const url of ['/api/v1/portfolio', '/api/v1/broker/status', '/api/v1/market/005930/quote', '/api/v1/me/console/orders', '/api/v1/console/orders']) {
      expect((await s.app.inject(url)).statusCode).toBe(401);
    }
    expect((await s.app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: {} })).statusCode).toBe(401);
    expect((await s.app.inject({ url: '/api/v1/me/console/orders', headers: { authorization: `Bearer ${'r'.repeat(32)}` } })).statusCode).toBe(401);
    expect((await s.app.inject({ url: '/api/v1/portfolio', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
    expect((await s.app.inject({ method: 'POST', url: '/api/v1/orders', headers: { authorization: `Bearer ${token}` }, payload: {} })).statusCode).toBe(401);
    const forged = await s.app.inject({ url: '/api/v1/me/console/orders?executionAccount=account-b', headers: { authorization: `Bearer ${token}` } });
    expect(forged.statusCode).toBe(400);
    expect(s.portfolio).not.toHaveBeenCalled(); expect(s.listOrders).not.toHaveBeenCalled();
    expect((await s.app.inject('/health')).statusCode).toBe(200);
  } finally { await s.app.close(); }
});
