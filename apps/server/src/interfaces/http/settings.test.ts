import { expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.ts';
import { parseEnvironment } from '../../app/environment.ts';
import { DEFAULT_OWNER_SETTINGS } from '../../domain/settings/ownerSettings.ts';
import { authSetup } from '../../../test/authSetup.ts';

it('reads settings for the owner and changes them only with the password and valid, stricter limits', async () => {
  const s = authSetup();
  const inserted: unknown[] = [];
  const ownerSettings = { effectiveOn: async () => null, pendingAfter: async () => null, history: async () => [],
    insert: vi.fn(async (_a: string, settings: unknown) => { inserted.push(settings); }) };
  const app = createApp(parseEnvironment({ DATABASE_URL: 'postgres://test:test@localhost/test' }), { checkConnection: async () => {} }, {
    auth: s.auth, executionAccount: 'account-a', ownerSettings,
    consoleRead: { listOrders: async () => [], listLoopRuns: async () => [], listSnapshots: async () => [], latestPlanRun: async () => null },
    marketBroker: { isConfigured: () => false, getQuote: vi.fn() }, accountBroker: { getPortfolio: vi.fn() }, riskContextProvider: { getRiskContext: vi.fn() } }, false);
  try {
    expect((await app.inject({ url: '/api/v1/me/console/settings' })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: s.credentials });
    for (const identity of s.sessions.values()) identity.executionAccount = 'account-a';
    const headers = { authorization: `Bearer ${login.json().token}` };
    const status = await app.inject({ url: '/api/v1/me/console/settings', headers });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ effective: DEFAULT_OWNER_SETTINGS, pending: null, environment: { momentumExecution: false } });
    const post = (body: unknown) => app.inject({ method: 'POST', url: '/api/v1/me/settings', headers, payload: body as object });
    expect((await post({ password: 'wrong-password-123456', settings: DEFAULT_OWNER_SETTINGS })).statusCode).toBe(403);
    const loose = { ...DEFAULT_OWNER_SETTINGS, risk: { ...DEFAULT_OWNER_SETTINGS.risk, maxDailyLossRate: '0.05' } };
    const invalid = await post({ password: s.credentials.password, settings: loose });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toEqual({ error: { code: 'invalid_settings', fields: ['risk.maxDailyLossRate'] } });
    expect(inserted).toHaveLength(0);
    expect((await post({ password: s.credentials.password, settings: { ...DEFAULT_OWNER_SETTINGS, dayPreset: 'day-quick' } })).statusCode).toBe(200);
    expect(inserted).toEqual([{ ...DEFAULT_OWNER_SETTINGS, dayPreset: 'day-quick' }]);
  } finally { await app.close(); }
});
