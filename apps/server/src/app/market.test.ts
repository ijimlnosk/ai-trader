import { expect, it, vi } from 'vitest';
import { createApp } from './createApp.ts';
import { parseEnvironment } from './environment.ts';
import { createKisQuoteAdapter } from '../infrastructure/broker/kis/index.ts';
import { KIS_PAPER_URL, type KisFetch } from '../infrastructure/broker/kis/kisClient.ts';
import { BrokerError, type BrokerErrorCode } from '../application/brokerError.ts';

const secrets = ['fixture-key', 'fixture-secret', 'fixture-token', 'fixture-account', 'fixture-db-secret'];
const environment = parseEnvironment({ DATABASE_URL: `postgresql://test:${secrets[4]}@localhost/test`, KIS_APP_KEY: secrets[0], KIS_APP_SECRET: secrets[1], KIS_ACCOUNT_NO: secrets[3] });
const database = { checkConnection: async () => {} };
const quote = { rt_cd: '0', output: { stck_prpr: '70000', prdy_vrss: '100', prdy_ctrt: '0.14', acml_vol: '123' } };
const json = (value: unknown) => new Response(JSON.stringify(value));
function setup() {
  const fetcher = vi.fn<KisFetch>().mockImplementation(async (url) =>
    String(url).endsWith('/oauth2/tokenP')
      ? json({ access_token: secrets[2], token_type: 'Bearer', expires_in: 3600 }) : json(quote));
  const broker = createKisQuoteAdapter({ baseUrl: KIS_PAPER_URL, appKey: secrets[0], appSecret: secrets[1] }, fetcher);
  return { fetcher, app: createApp(environment, database, false, broker) };
}
it('serves quote and probes actual provider for each status while reusing token', async () => {
  const { app, fetcher } = setup();
  try {
    const response = await app.inject('/api/v1/market/005930/quote');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ symbol: '005930', price: '70000', change: '100', changeRate: '0.14', volume: '123', timestamp: expect.any(String) });
    for (let i = 0; i < 2; i++) {
      const status = await app.inject('/api/v1/broker/status');
      expect(status.statusCode).toBe(200);
      expect(status.json()).toEqual({ provider: 'kis', mode: 'paper', configured: true, reachable: true });
      for (const secret of secrets) expect(status.body + response.body).not.toContain(secret);
    }
    expect(fetcher).toHaveBeenCalledTimes(4);
    fetcher.mockRejectedValueOnce(new Error(secrets.join(' ')));
    expect((await app.inject('/api/v1/broker/status')).json()).toMatchObject({ configured: true, reachable: false, error: 'provider_unavailable' });
  } finally { await app.close(); }
});
it.each(['abc', '5930', '005930xxx', '1234567', '１２３４５６', '005930\n'])('returns 400 for %s before requesting a token', async (symbol) => {
  const { app, fetcher } = setup();
  try {
    const response = await app.inject(`/api/v1/market/${encodeURIComponent(symbol)}/quote`);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('invalid_symbol');
    expect(fetcher).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
it('reports missing credentials and fails quote as configuration error', async () => {
  const app = createApp(parseEnvironment({ DATABASE_URL: 'postgresql://test:test@localhost/test' }), database, false);
  try {
    expect((await app.inject('/api/v1/broker/status')).json()).toEqual({ provider: 'kis', mode: 'paper', configured: false, reachable: false, error: 'configuration_error' });
    const response = await app.inject('/api/v1/market/005930/quote');
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('configuration_error');
  } finally { await app.close(); }
});
it.each<[BrokerErrorCode, number]>([
  ['configuration_error', 503], ['authentication_error', 502],
  ['provider_unavailable', 503], ['provider_invalid_response', 502],
])('maps %s to HTTP %s and status failure', async (code, httpStatus) => {
  const app = createApp(environment, database, false, { isConfigured: () => true, getQuote: async () => { throw new BrokerError(code); } });
  try {
    const response = await app.inject('/api/v1/market/005930/quote');
    expect(response.statusCode).toBe(httpStatus);
    expect(response.json().error.code).toBe(code);
    expect((await app.inject('/api/v1/broker/status')).json()).toMatchObject({ configured: true, reachable: false, error: code });
  } finally { await app.close(); }
});
it('never logs or responds with raw unexpected errors or sensitive request headers', async () => {
  const logged: string[] = [];
  const app = createApp(environment, database, { write: (chunk) => { logged.push(chunk); } }, {
    isConfigured: () => true, getQuote: async () => { throw new Error(secrets.join(' ')); },
  });
  try {
    for (const url of ['/api/v1/market/005930/quote', '/api/v1/broker/status']) {
      const response = await app.inject({ url, headers: { authorization: secrets[2], appsecret: secrets[1] } });
      expect(response.statusCode).toBe(500);
      for (const secret of secrets) expect(response.body + logged.join('')).not.toContain(secret);
    }
    expect(logged.join('')).toContain('market_request_failed');
  } finally { await app.close(); }
});
it('only accepts paper KIS URL and does not expose invalid environment values', () => {
  for (const value of ['https://example.com', `${KIS_PAPER_URL}/evil`, `${KIS_PAPER_URL}?secret=fixture-secret`]) {
    expect(() => parseEnvironment({ ...environment, KIS_BASE_URL: value })).toThrow('KIS_BASE_URL');
    expect(() => parseEnvironment({ ...environment, KIS_BASE_URL: value })).not.toThrow(value);
  }
});
