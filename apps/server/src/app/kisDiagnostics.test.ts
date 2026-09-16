import { afterEach, expect, it, vi } from 'vitest';
import { createRuntimeApp } from './createRuntimeApp.ts';
import { parseEnvironment } from './environment.ts';

const secrets = ['fixture-key', 'fixture-secret', 'fixture-token', '12345678', 'private-provider-message'];
const environment = parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost/test',
  KIS_APP_KEY: secrets[0], KIS_APP_SECRET: secrets[1], KIS_ACCOUNT_NO: secrets[3], KIS_ACCOUNT_PRODUCT_CODE: '01' });
const database = { checkConnection: async () => {} };
const input = { symbol: '005930', side: 'BUY', quantity: '1', estimatedPrice: '70000', confidence: '0.82' };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { tr_cont: 'D' } });
afterEach(() => vi.unstubAllGlobals());

it.each([
  ['APBK0919', 'APBK0919', 503, 'provider_unavailable'],
  ['EGW00123', 'EGW00123', 502, 'authentication_error'],
  ['EGW00201', 'EGW00201', 503, 'provider_unavailable'],
  [secrets.join(' '), 'UNRECOGNIZED', 503, 'provider_unavailable'],
  [undefined, 'UNRECOGNIZED', 503, 'provider_unavailable'],
])('logs safe balance diagnostics for %s while portfolio/risk fail closed', async (msgCode, expectedCode, status, errorCode) => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/oauth2/tokenP')) return json({ access_token: secrets[2], token_type: 'Bearer', expires_in: 3600 });
    return json({ rt_cd: '1', msg_cd: msgCode, msg1: secrets.join(' '), CANO: secrets[3], access_token: secrets[2] });
  });
  vi.stubGlobal('fetch', fetcher);
  const logs: string[] = [];
  const app = createRuntimeApp(environment, database, { write: (chunk) => { logs.push(chunk); } });
  try {
    const portfolio = await app.inject('/api/v1/portfolio');
    expect(portfolio.statusCode).toBe(status);
    expect(portfolio.json().error.code).toBe(errorCode);
    expect(fetcher).toHaveBeenCalledTimes(2); // Token and one balance request, no blind retry.
    const risk = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(risk.statusCode).toBe(503);
    expect(risk.json()).toEqual({ error: { code: 'risk_context_unavailable' } });
    const diagnostics = logs.flatMap((chunk) => chunk.trim().split('\n')).filter((line) => line.includes('"provider":"kis"'));
    expect(diagnostics).toHaveLength(2);
    for (const line of diagnostics) {
      expect(JSON.parse(line)).toMatchObject({ provider: 'kis', operation: 'inquire_balance', msgCode: expectedCode });
    }
    for (const secret of secrets) expect(logs.join('') + portfolio.body + risk.body).not.toContain(secret);
    expect(logs.join('')).not.toContain('msg1');
    expect(portfolio.body + risk.body).not.toContain('msgCode');
  } finally { await app.close(); }
});
it('does not emit rejection diagnostics for a successful portfolio', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ access_token: secrets[2], token_type: 'Bearer', expires_in: 3600 }))
    .mockResolvedValueOnce(json({ rt_cd: '0', msg_cd: 'APBK0013', output1: [],
      output2: [{ dnca_tot_amt: '10000000', tot_evlu_amt: '10000000', pchs_amt_smtl_amt: '0', evlu_pfls_smtl_amt: '0' }] }));
  vi.stubGlobal('fetch', fetcher);
  const logs: string[] = [];
  const app = createRuntimeApp(environment, database, { write: (chunk) => { logs.push(chunk); } });
  try {
    const response = await app.inject('/api/v1/portfolio');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ cash: '10000000', totalEvaluation: '10000000', totalPurchaseAmount: '0',
      totalProfitLoss: '0', totalProfitLossRate: '0.00', positions: [] });
    expect(logs.join('')).not.toContain('"provider":"kis"');
  } finally { await app.close(); }
});
