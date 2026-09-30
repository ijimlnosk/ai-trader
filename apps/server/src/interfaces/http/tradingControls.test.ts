import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app/createApp.ts';
import { parseEnvironment } from '../../app/environment.ts';
import type { TradingControlEvent, TradingControlRepository, TradingControlState } from '../../application/controls/index.ts';
import { authSetup } from '../../../test/authSetup.ts';

function memoryControls(): TradingControlRepository & { events_: TradingControlEvent[] } {
  let state: TradingControlState = { enabled: false, updatedAt: null, updatedByEmail: null };
  const events_: TradingControlEvent[] = [];
  return {
    events_,
    get: async () => state,
    async set(_account, enabled) {
      state = { enabled, updatedAt: '2026-09-30T00:00:00.000Z', updatedByEmail: 'owner@example.test' };
      events_.unshift({ enabled, at: state.updatedAt!, byEmail: state.updatedByEmail });
      return state;
    },
    events: async (_account, limit) => events_.slice(0, limit),
  };
}

const armed = { PAPER_ORDER_EXECUTION_ENABLED: 'true', PAPER_LOOP_ENABLED: 'true', PAPER_LOOP_SCHEDULE_ENABLED: 'true' };
function setup(env: Record<string, string> = armed) {
  const s = authSetup();
  const controls = memoryControls();
  const submit = vi.fn();
  const app = createApp(parseEnvironment({ DATABASE_URL: 'postgres://test:test@localhost/test', ORDER_API_TOKEN: 'o'.repeat(32), ...env }),
    { checkConnection: async () => {} }, { orders: { submit, get: vi.fn(), reconcile: vi.fn() }, auth: s.auth, executionAccount: 'account-a',
      consoleRead: { listOrders: async () => [], listLoopRuns: async () => [], listSnapshots: async () => [], latestPlanRun: async () => null }, tradingControls: controls,
      paperLoopRuns: { find: vi.fn(), claim: vi.fn(), update: vi.fn(), findOrder: vi.fn(), hasUnresolvedOrder: vi.fn() },
      dailySnapshots: { latest: vi.fn(), latestThrough: vi.fn(), save: vi.fn() }, dailyHistory: { getDailyHistory: vi.fn() },
      marketBroker: { isConfigured: () => false, getQuote: vi.fn() }, accountBroker: { getPortfolio: vi.fn() },
      riskContextProvider: { getRiskContext: vi.fn() } }, false);
  return { ...s, app, controls, submit };
}
async function login(s: ReturnType<typeof setup>) {
  const response = await s.app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: s.credentials });
  return { authorization: `Bearer ${response.json().token}` };
}
const post = (s: ReturnType<typeof setup>, headers: Record<string, string>, payload: Record<string, unknown>) =>
  s.app.inject({ method: 'POST', url: '/api/v1/me/controls/auto-trading', headers, payload });

describe('owner automatic trading control', () => {
  it('defaults to paused and reports the environment master switch', async () => {
    const s = setup();
    try {
      const headers = await login(s);
      const response = await s.app.inject({ url: '/api/v1/me/console/controls', headers });
      expect(response.json()).toEqual({ autoTrading: { enabled: false, environmentAllows: true, effective: false,
        updatedAt: null, updatedByEmail: null }, events: [] });
    } finally { await s.app.close(); }
  });

  it('resumes only with the current password, pauses without one, and audits both', async () => {
    const s = setup();
    try {
      const headers = await login(s);
      expect((await post(s, headers, { enabled: true })).statusCode).toBe(400);
      const wrong = await post(s, headers, { enabled: true, password: 'wrong-password-value' });
      expect([wrong.statusCode, wrong.json()]).toEqual([403, { error: { code: 'password_incorrect' } }]);
      expect(s.controls.events_).toHaveLength(0);
      const resumed = await post(s, headers, { enabled: true, password: s.credentials.password });
      expect(resumed.json().autoTrading).toMatchObject({ enabled: true, effective: true });
      const paused = await post(s, headers, { enabled: false });
      expect(paused.json().autoTrading).toMatchObject({ enabled: false, effective: false });
      expect(s.controls.events_.map((event) => event.enabled)).toEqual([false, true]);
      expect(s.submit).not.toHaveBeenCalled();
    } finally { await s.app.close(); }
  });

  it('counts step-up failures against the login budget', async () => {
    const s = setup();
    try {
      const headers = await login(s);
      s.repository.consumeAttempt.mockResolvedValue(false);
      const limited = await post(s, headers, { enabled: true, password: s.credentials.password });
      expect([limited.statusCode, limited.headers['retry-after']]).toEqual([429, '900']);
      expect(s.controls.events_).toHaveLength(0);
    } finally { await s.app.close(); }
  });

  it('cannot resume when the environment does not allow automatic trading', async () => {
    const s = setup({});
    try {
      const headers = await login(s);
      const response = await post(s, headers, { enabled: true, password: s.credentials.password });
      expect([response.statusCode, response.json()]).toEqual([409, { error: { code: 'control_not_allowed' } }]);
      expect((await post(s, headers, { enabled: false })).statusCode).toBe(200);
    } finally { await s.app.close(); }
  });

  it('rejects anonymous, other-account and machine-token callers, and unknown fields', async () => {
    const s = setup();
    try {
      expect((await post(s, {}, { enabled: false })).statusCode).toBe(401);
      expect((await post(s, { authorization: `Bearer ${'o'.repeat(32)}` }, { enabled: false })).statusCode).toBe(401);
      const headers = await login(s);
      expect((await post(s, headers, { enabled: false, liveTradingEnabled: true })).statusCode).toBe(400);
      for (const identity of s.sessions.values()) identity.executionAccount = 'account-b';
      expect((await post(s, headers, { enabled: false })).statusCode).toBe(403);
      expect(s.controls.events_).toHaveLength(0);
    } finally { await s.app.close(); }
  });
});
