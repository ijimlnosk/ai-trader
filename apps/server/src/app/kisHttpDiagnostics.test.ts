import { afterEach, expect, it, vi } from 'vitest';
import { createRuntimeApp } from './createRuntimeApp.ts';
import { parseEnvironment } from './environment.ts';

const databaseUrl = 'postgresql://test:fixture-db-secret@localhost/test';
const secrets = ['12345678', 'fixture-key', 'fixture-secret', 'fixture-token', databaseUrl, 'private-msg1'];
const environment = parseEnvironment({ DATABASE_URL: databaseUrl, KIS_ACCOUNT_NO: secrets[0],
  KIS_APP_KEY: secrets[1], KIS_APP_SECRET: secrets[2], KIS_ACCOUNT_PRODUCT_CODE: '01' });
const database = { checkConnection: async () => {} };
const input = { symbol: '005930', side: 'BUY', quantity: '1', estimatedPrice: '70000', confidence: '0.82' };
const token = { access_token: secrets[3], token_type: 'Bearer', expires_in: 3600 };
afterEach(() => vi.unstubAllGlobals());

it.each([400, 401, 403, 429, 500, 503])('records the KIS code from HTTP %s before generic mapping, and risk remains blocked', async (httpStatus) => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => String(url).endsWith('/oauth2/tokenP')
    ? new Response(JSON.stringify(token))
    : new Response(JSON.stringify({ rt_cd: '1', msg_cd: 'APBK0919', msg1: secrets.join(' '), authorization: secrets[3] }), { status: httpStatus }));
  vi.stubGlobal('fetch', fetcher);
  const logs: string[] = [];
  const app = createRuntimeApp(environment, database, { write: (chunk) => { logs.push(chunk); } });
  try {
    const portfolio = await app.inject('/api/v1/portfolio');
    expect(portfolio.statusCode).toBe([401, 403].includes(httpStatus) ? 502 : 503);
    expect(portfolio.json().error.code).toBe([401, 403].includes(httpStatus) ? 'authentication_error' : 'provider_unavailable');
    const risk = await app.inject({ method: 'POST', url: '/api/v1/risk/evaluate', payload: input });
    expect(risk.statusCode).toBe(503);
    expect(risk.json()).toEqual({ error: { code: 'risk_context_unavailable' } });
    const events = logs.flatMap((chunk) => chunk.trim().split('\n')).filter((line) => line.includes('"provider":"kis"'));
    expect(events).toHaveLength(2);
    for (const event of events) expect(JSON.parse(event)).toMatchObject({
      provider: 'kis', operation: 'inquire_balance', transactionId: 'VTTC8434R', msgCode: 'APBK0919', httpStatus,
    });
    for (const secret of secrets) expect(logs.join('') + portfolio.body + risk.body).not.toContain(secret);
    for (const forbidden of ['msg1', 'authorization', 'appkey', 'appsecret', 'CANO', 'DATABASE_URL']) expect(logs.join('')).not.toContain(forbidden);
    expect(portfolio.body + risk.body).not.toContain('APBK0919');
  } finally { await app.close(); }
});
it('distinguishes quote rejection from balance rejection without exposing request headers', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(token)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ rt_cd: '1', msg_cd: 'EGW00201', msg1: secrets.join(' ') }))));
  const logs: string[] = [];
  const app = createRuntimeApp(environment, database, { write: (chunk) => { logs.push(chunk); } });
  try {
    const response = await app.inject({ url: '/api/v1/market/005930/quote', headers: { authorization: 'fixture-token', appkey: 'fixture-key' } });
    expect(response.statusCode).toBe(503);
    const events = logs.flatMap((chunk) => chunk.trim().split('\n')).filter((line) => line.includes('"provider":"kis"'));
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]!)).toMatchObject({ provider: 'kis', operation: 'inquire_price',
      transactionId: 'FHKST01010100', msgCode: 'EGW00201', httpStatus: 200 });
    for (const secret of secrets) expect(logs.join('') + response.body).not.toContain(secret);
    expect(response.body).not.toContain('EGW00201');
  } finally { await app.close(); }
});
it.each([401, 503])('non-JSON HTTP %s failures preserve the existing generic error', async (httpStatus) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify(token)))
    .mockResolvedValueOnce(new Response('<html>private-msg1</html>', { status: httpStatus })));
  const logs: string[] = [];
  const app = createRuntimeApp(environment, database, { write: (chunk) => { logs.push(chunk); } });
  try {
    const response = await app.inject('/api/v1/portfolio');
    expect(response.statusCode).toBe(httpStatus === 401 ? 502 : 503);
    expect(response.json().error.code).toBe(httpStatus === 401 ? 'authentication_error' : 'provider_unavailable');
    expect(logs.join('') + response.body).not.toContain('private-msg1');
  } finally { await app.close(); }
});
