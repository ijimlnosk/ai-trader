import { setTimeout as delay } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { createKisBroker, KIS_PAPER_URL } from './index.ts';
import type { KisFetch } from './kisClient.ts';
import { createApp } from '../../../app/createApp.ts';
import { parseEnvironment } from '../../../app/environment.ts';
import { BrokerError, type BrokerErrorCode } from '../../../application/brokerError.ts';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => undefined) }));

// Deliberately fake credentials; no external requests are made.
const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret', accountNo: '12345678', accountProductCode: '01' };
const token = { access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 };
const summary = { dnca_tot_amt: '10000000', tot_evlu_amt: '10200000', pchs_amt_smtl_amt: '9800000', evlu_pfls_smtl_amt: '400000' };
const position = { pdno: '005930', prdt_name: '삼성전자', hldg_qty: '10', ord_psbl_qty: '8', pchs_avg_pric: '70000.1250', prpr: '71000', evlu_amt: '710000', evlu_pfls_amt: '9998.7500', evlu_pfls_rt: '1.428' };
const expectedPosition = { symbol: '005930', name: '삼성전자', quantity: '10', availableQuantity: '8', averagePrice: '70000.1250', currentPrice: '71000', evaluationAmount: '710000', profitLoss: '9998.7500', profitLossRate: '1.428' };
const page = { rt_cd: '0', output1: [position], output2: [summary], ctx_area_fk100: '', ctx_area_nk100: '' };
const json = (body: unknown, continuation = 'D', status = 200) => new Response(JSON.stringify(body), { status, headers: { tr_cont: continuation } });
function setup(body: unknown = page) {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockImplementation(async () => json(body));
  return { fetcher, broker: createKisBroker(config, fetcher) };
}
const environment = parseEnvironment({ DATABASE_URL: 'postgresql://test:fixture-db-secret@localhost/test', KIS_APP_KEY: config.appKey, KIS_APP_SECRET: config.appSecret, KIS_ACCOUNT_NO: config.accountNo, KIS_ACCOUNT_PRODUCT_CODE: config.accountProductCode });
const database = { checkConnection: async () => {} };

it('returns empty positions with actual cash and a defined zero-cost percentage', async () => {
  const { broker } = setup({ ...page, output1: [], output2: [{ ...summary, tot_evlu_amt: '10000000', pchs_amt_smtl_amt: '0', evlu_pfls_smtl_amt: '0' }] });
  expect(await broker.getPortfolio()).toEqual({ cash: '10000000', totalEvaluation: '10000000', totalPurchaseAmount: '0', totalProfitLoss: '0', totalProfitLossRate: '0.00', positions: [] });
});
it('maps multiple positions and preserves exact large/decimal strings', async () => {
  const { broker } = setup({ ...page, output1: [position, { ...position, pdno: '000660', prdt_name: 'SK하이닉스', hldg_qty: '9007199254740993', evlu_pfls_amt: '-0.1250', evlu_pfls_rt: '-1.00' }] });
  const portfolio = await broker.getPortfolio();
  expect(portfolio).toMatchObject({ cash: '10000000', totalEvaluation: '10200000', totalPurchaseAmount: '9800000', totalProfitLoss: '400000', totalProfitLossRate: '4.08' });
  expect(portfolio.positions).toEqual([expectedPosition, { ...expectedPosition, symbol: '000660', name: 'SK하이닉스', quantity: '9007199254740993', profitLoss: '-0.1250', profitLossRate: '-1.00' }]);
});
it('uses the paper balance endpoint and exact account/query parameters', async () => {
  const { fetcher, broker } = setup();
  await broker.getPortfolio();
  const [url, init] = fetcher.mock.calls[1]!;
  const parsed = new URL(String(url));
  expect(parsed.origin).toBe(KIS_PAPER_URL);
  expect(parsed.pathname).toBe('/uapi/domestic-stock/v1/trading/inquire-balance');
  expect(Object.fromEntries(parsed.searchParams)).toEqual({ CANO: config.accountNo, ACNT_PRDT_CD: '01', AFHR_FLPR_YN: 'N', OFL_YN: '', INQR_DVSN: '02', UNPR_DVSN: '01', FUND_STTL_ICLD_YN: 'N', FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00', CTX_AREA_FK100: '', CTX_AREA_NK100: '' });
  expect(init).toMatchObject({ method: 'GET', redirect: 'error', headers: { tr_id: 'VTTC8434R', tr_cont: '', authorization: 'Bearer fixture-token' } });
});
it('follows F/M pages with N, preserves cursors and never sums repeated summaries', async () => {
  vi.mocked(delay).mockClear();
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token))
    .mockResolvedValueOnce(json({ ...page, ctx_area_fk100: 'fk ', ctx_area_nk100: 'nk1 ' }, 'F'))
    .mockResolvedValueOnce(json({ ...page, output1: [{ ...position, pdno: '000660' }], ctx_area_fk100: 'fk ', ctx_area_nk100: 'nk2 ' }, 'M'))
    .mockResolvedValueOnce(json({ ...page, output1: [{ ...position, pdno: '035420' }] }, 'E'));
  const portfolio = await createKisBroker(config, fetcher).getPortfolio();
  expect(delay).toHaveBeenCalledTimes(2);
  expect(delay).toHaveBeenCalledWith(1000);
  expect(portfolio.positions.map((row) => row.symbol)).toEqual(['005930', '000660', '035420']);
  expect(portfolio.cash).toBe(summary.dnca_tot_amt);
  expect(portfolio.totalProfitLoss).toBe(summary.evlu_pfls_smtl_amt);
  const [url, init] = fetcher.mock.calls[2]!;
  expect(new URL(String(url)).searchParams.get('CTX_AREA_NK100')).toBe('nk1 ');
  expect(new URL(String(url)).searchParams.get('CTX_AREA_FK100')).toBe('fk ');
  expect(init).toMatchObject({ headers: { tr_cont: 'N' } });
});
it('filters zero-quantity historical rows', async () => {
  const { broker } = setup({ ...page, output1: [{ ...position, hldg_qty: '0', ord_psbl_qty: '0' }] });
  expect((await broker.getPortfolio()).positions).toEqual([]);
});
it.each([
  {}, { ...page, output1: {} }, { ...page, output2: null },
  { ...page, output2: [{ ...summary, dnca_tot_amt: 10000000 }] },
  { ...page, output2: [{ ...summary, pchs_amt_smtl_amt: '0' }] },
  { ...page, output1: [{ ...position, hldg_qty: '-1' }] },
  { ...page, output1: [{ ...position, pchs_avg_pric: 'NaN' }] },
  { ...page, output1: [{ ...position, evlu_pfls_rt: '1.0\n' }] },
  { ...page, output1: [{ ...position, ord_psbl_qty: '11' }] },
  { ...page, output1: [position, position] },
])('rejects malformed/inconsistent balance %j', async (body) => {
  await expect(setup(body).broker.getPortfolio()).rejects.toMatchObject({ code: 'provider_invalid_response' });
});
it.each([[], undefined])('distinguishes missing account summary (%j) from empty holdings', async (output2) => {
  await expect(setup({ ...page, output1: [], output2 }).broker.getPortfolio()).rejects.toMatchObject({ code: 'account_unavailable' });
});
it.each([
  { accountNo: undefined }, { accountProductCode: undefined }, { accountNo: '1234' },
  { accountNo: '12345678-01' }, { accountProductCode: '1' }, { accountNo: '1234567\n' },
])('rejects missing/invalid account configuration before network access', async (invalid) => {
  const fetcher = vi.fn<KisFetch>();
  await expect(createKisBroker({ ...config, ...invalid }, fetcher).getPortfolio()).rejects.toMatchObject({ code: 'configuration_error' });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([401, 403, 429, 500])('sanitizes provider HTTP %s', async (status) => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ msg1: config.accountNo + config.appSecret }, 'D', status));
  await expect(createKisBroker(config, fetcher).getPortfolio()).rejects.toMatchObject({ code: status < 429 ? 'authentication_error' : 'provider_unavailable' });
});
it('sanitizes provider business failure and malformed JSON', async () => {
  await expect(setup({ rt_cd: '1', msg_cd: 'unknown', msg1: config.accountNo }).broker.getPortfolio()).rejects.toMatchObject({ code: 'provider_unavailable' });
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(new Response('{'));
  await expect(createKisBroker(config, fetcher).getPortfolio()).rejects.toMatchObject({ code: 'provider_invalid_response' });
});
it('shares token issuance for concurrent quote and portfolio requests', async () => {
  const fetcher = vi.fn<KisFetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/oauth2/tokenP')) return json(token);
    if (String(url).includes('inquire-price')) return json({ rt_cd: '0', output: { stck_prpr: '70000', prdy_vrss: '100', prdy_ctrt: '0.1', acml_vol: '100' } });
    return json(page);
  });
  // Exercise real composition too: both routes use the same session by default.
  vi.stubGlobal('fetch', fetcher);
  const app = createApp(environment, database, false);
  try {
    const responses = await Promise.all([app.inject('/api/v1/portfolio'), app.inject('/api/v1/market/005930/quote')]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/oauth2/tokenP'))).toHaveLength(1);
  } finally { await app.close(); vi.unstubAllGlobals(); }
});
it('invalidates the shared token after portfolio authentication rejection', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token))
    .mockResolvedValueOnce(json({ rt_cd: '1', msg_cd: 'EGW00123' }))
    .mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(page));
  const broker = createKisBroker(config, fetcher);
  await expect(broker.getPortfolio()).rejects.toMatchObject({ code: 'authentication_error' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await broker.getPortfolio();
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it.each(['missing cursor', 'unknown header', 'missing header', 'loop', 'changed summary', 'later failure', 'page limit'])('rejects incomplete pagination: %s', async (scenario) => {
  let count = 0;
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockImplementation(async () => {
    count++;
    const body = { ...page, output1: [], ctx_area_fk100: 'fk', ctx_area_nk100: scenario === 'loop' ? 'same' : String(count) };
    if (scenario === 'missing cursor') return json({ ...body, ctx_area_fk100: '', ctx_area_nk100: '' }, 'F');
    if (scenario === 'unknown header') return json(body, 'X');
    if (scenario === 'missing header') return new Response(JSON.stringify(body));
    if (scenario === 'later failure' && count === 2) return json({}, 'D', 500);
    if (scenario === 'changed summary' && count === 2) return json({ ...body, output2: [{ ...summary, dnca_tot_amt: '1' }] });
    return json(body, 'M');
  });
  await expect(createKisBroker(config, fetcher).getPortfolio()).rejects.toMatchObject({ code: scenario === 'later failure' ? 'provider_unavailable' : 'provider_invalid_response' });
  expect(count).toBeLessThanOrEqual(20);
});
it('returns only internal fields and omits account/secret data from success response and logs', async () => {
  const { broker } = setup({ ...page, CANO: config.accountNo, appsecret: config.appSecret, output1: [{ ...position, access_token: token.access_token }], output2: [{ ...summary, account: config.accountNo }] });
  const logs: string[] = [];
  const app = createApp(environment, database, { write: (chunk) => { logs.push(chunk); } }, broker, broker);
  try {
    const response = await app.inject('/api/v1/portfolio');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ cash: summary.dnca_tot_amt, totalEvaluation: summary.tot_evlu_amt, totalPurchaseAmount: summary.pchs_amt_smtl_amt, totalProfitLoss: summary.evlu_pfls_smtl_amt, totalProfitLossRate: '4.08', positions: [expectedPosition] });
    for (const secret of [config.accountNo, config.appKey, config.appSecret, token.access_token, 'fixture-db-secret']) expect(response.body + logs.join('')).not.toContain(secret);
  } finally { await app.close(); }
});
it.each<[BrokerErrorCode, number]>([
  ['configuration_error', 503], ['authentication_error', 502], ['provider_unavailable', 503],
  ['provider_invalid_response', 502], ['account_unavailable', 503],
])('maps API error %s to %s', async (code, status) => {
  const app = createApp(environment, database, false, undefined, { getPortfolio: async () => { throw new BrokerError(code); } });
  try {
    const response = await app.inject('/api/v1/portfolio');
    expect(response.statusCode).toBe(status);
    expect(response.json().error.code).toBe(code);
  } finally { await app.close(); }
});
it('omits provider failure payloads and request headers from error response/logs', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockRejectedValue(new Error(`${config.accountNo} ${config.appSecret} ${token.access_token}`));
  const broker = createKisBroker(config, fetcher);
  const logs: string[] = [];
  const app = createApp(environment, database, { write: (chunk) => { logs.push(chunk); } }, broker, broker);
  try {
    const response = await app.inject({ url: '/api/v1/portfolio', headers: { authorization: token.access_token, appsecret: config.appSecret } });
    expect(response.statusCode).toBe(503);
    for (const secret of [config.accountNo, config.appSecret, token.access_token]) expect(response.body + logs.join('')).not.toContain(secret);
    expect(logs.join('')).toContain('portfolio_request_failed');
  } finally { await app.close(); }
});

it('allows an empty search-condition cursor when the next-page cursor advances', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token))
    .mockResolvedValueOnce(json({ ...page, ctx_area_fk100: '', ctx_area_nk100: 'next' }, 'F'))
    .mockResolvedValueOnce(json({ ...page, output1: [] }, 'D'));
  expect((await createKisBroker(config, fetcher).getPortfolio()).positions).toEqual([expectedPosition]);
});
