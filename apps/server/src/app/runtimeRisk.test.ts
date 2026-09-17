import { memoryOrders } from '../../test/orderFixtures.ts';
import { afterEach, expect, it, vi } from 'vitest';
import { createRuntimeApp } from './createRuntimeApp.ts';
import { parseEnvironment } from './environment.ts';

const environment = parseEnvironment({
  DATABASE_URL: 'postgresql://test:test@localhost/test', KIS_APP_KEY: 'fixture-key',
  KIS_APP_SECRET: 'fixture-secret', KIS_ACCOUNT_NO: '12345678', KIS_ACCOUNT_PRODUCT_CODE: '01',
});
const database = { checkConnection: async () => {} };
const input = { symbol: '005930', side: 'BUY', quantity: '1', estimatedPrice: '70000', confidence: '0.82' };
const portfolio = { cash: '10000000', totalEvaluation: '10000000', positions: [] };
const page = {
  rt_cd: '0', output1: [],
  output2: [{ dnca_tot_amt: '10000000', tot_evlu_amt: '10000000', pchs_amt_smtl_amt: '0', evlu_pfls_smtl_amt: '0' }],
};
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { tr_cont: 'D' } });
afterEach(() => vi.unstubAllGlobals());

it('production composition uses the real KIS adapter/provider and shares its token with portfolio reads', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/oauth2/tokenP')) return json({ access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 });
    if (new URL(String(url)).pathname === '/uapi/domestic-stock/v1/trading/inquire-balance') return json(page);
    throw new Error('Unexpected external request');
  });
  vi.stubGlobal('fetch', fetcher);
  // This is the exact composition function used by server.ts, with no provider/broker override.
  const app = createRuntimeApp(environment, database, false, undefined, undefined, memoryOrders().repository);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ approved: true, approvedQuantity: '1', reasons: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await app.inject('/api/v1/portfolio')).statusCode).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/oauth2/tokenP'))).toHaveLength(1);
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'GET', headers: { tr_id: 'VTTC8434R' } });
    // A later provider outage must not reuse the successful approval/context.
    fetcher.mockRejectedValueOnce(new Error('fixture-private-secret'));
    const failed = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(failed.statusCode).toBe(503);
    expect(failed.json()).toEqual({ error: { code: 'risk_context_unavailable' } });
    expect(failed.body).not.toContain('fixture-private-secret');
  } finally { await app.close(); }
});
it.each([
  {}, { ...page, output1: null },
  { ...page, output2: [{ ...page.output2[0], dnca_tot_amt: 'NaN' }] },
])('malformed KIS responses fail closed through production wiring %j', async (body) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 }))
    .mockResolvedValueOnce(json(body));
  vi.stubGlobal('fetch', fetcher);
  const app = createRuntimeApp(environment, database, false, undefined, undefined, memoryOrders().repository);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: { code: 'risk_context_unavailable' } });
  } finally { await app.close(); }
});
it.each([
  [portfolio, { approved: true, approvedQuantity: '1', reasons: [] }],
  [{ ...portfolio, cash: 'invalid' }, { approved: false, approvedQuantity: '0', reasons: ['INVALID_CONTEXT'] }],
  [{ ...portfolio, positions: null }, { approved: false, approvedQuantity: '0', reasons: ['INVALID_CONTEXT'] }],
  [{ ...portfolio, positions: Array.from({ length: 5 }, (_, i) => ({ symbol: String(i).padStart(6, '0'), quantity: '1' })) },
    { approved: false, approvedQuantity: '0', reasons: ['MAX_PORTFOLIO_POSITIONS_EXCEEDED'] }],
])('production provider maps an injected account port through the engine %j', async (value, expected) => {
  const getPortfolio = vi.fn().mockResolvedValue(value);
  const app = createRuntimeApp(environment, database, false, undefined, { getPortfolio }, {
    ...memoryOrders().repository,
    getTradeLedger: async () => ({ dailyRealizedPnl: '0', consecutiveLosses: 0,
      positions: (value.positions ?? []).map((p) => ({ ...p, costAmount: '70000' })) }),
  });
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expected);
    expect(getPortfolio).toHaveBeenCalledTimes(1);
  } finally { await app.close(); }
});

it('production risk wiring uses persistent history and environment kill switch', async () => {
  const repo = memoryOrders().repository;
  repo.getTradeLedger = async () => ({ dailyRealizedPnl: '-200000', consecutiveLosses: 3, positions: [] });
  const account = { getPortfolio: vi.fn().mockResolvedValue(portfolio) };
  const app = createRuntimeApp({ ...environment, TRADING_KILL_SWITCH_ENABLED: true }, database, false, undefined, account, repo);
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.json()).toMatchObject({ approved: false, reasons: expect.arrayContaining([
      'DAILY_LOSS_LIMIT_EXCEEDED', 'CONSECUTIVE_LOSS_LIMIT_EXCEEDED', 'KILL_SWITCH_ENABLED',
    ]) });
    repo.getTradeLedger = async () => { throw new Error('fixture-private-ledger-secret'); };
    const failed = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(failed.statusCode).toBe(503);
    expect(failed.body).not.toContain('fixture-private-ledger-secret');
  } finally { await app.close(); }
});
it('production risk cannot approve without a ledger repository even if execution is disabled', async () => {
  const app = createRuntimeApp(environment, database, false, undefined, { getPortfolio: vi.fn().mockResolvedValue(portfolio) });
  try {
    const response = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(response.json()).toMatchObject({ approved: false, reasons: ['INVALID_CONTEXT'] });
  } finally { await app.close(); }
});
