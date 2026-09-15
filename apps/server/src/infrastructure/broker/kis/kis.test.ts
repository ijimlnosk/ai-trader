import { expect, it, vi } from 'vitest';
import { createKisClient, KIS_PAPER_URL, type KisFetch } from './kisClient.ts';
import { createKisTokenProvider } from './kisTokenProvider.ts';
import { createKisBroker } from './index.ts';

const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret' };
const token = { access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 };
const quote = { rt_cd: '0', output: { stck_prpr: '70000', prdy_vrss: '-1000', prdy_ctrt: '-1.41', acml_vol: '9007199254740993' } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

it('issues token with official request, reuses it and refreshes before/after expiry', async () => {
  let now = 0;
  const fetcher = vi.fn<KisFetch>().mockImplementation(async () => json(token));
  const provider = createKisTokenProvider(createKisClient(config, fetcher), config, () => now);
  expect(await provider.getToken()).toBe(token.access_token);
  now = 3_539_999;
  await provider.getToken();
  expect(fetcher).toHaveBeenCalledTimes(1);
  now = 3_540_000;
  await provider.getToken();
  expect(fetcher).toHaveBeenCalledTimes(2);
  now += 3_600_001;
  await provider.getToken();
  expect(fetcher).toHaveBeenCalledTimes(3);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe(`${KIS_PAPER_URL}/oauth2/tokenP`);
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', signal: expect.any(AbortSignal) });
  expect(JSON.parse(String(init?.body))).toEqual({ grant_type: 'client_credentials', appkey: config.appKey, appsecret: config.appSecret });
});
it('coalesces concurrent issuance and clears pending state after failure', async () => {
  const fetcher = vi.fn<KisFetch>().mockImplementationOnce(async () => json({ secret: config.appSecret }, 401))
    .mockImplementation(async () => json(token));
  const provider = createKisTokenProvider(createKisClient(config, fetcher), config);
  const failures = await Promise.allSettled(Array.from({ length: 10 }, () => provider.getToken()));
  expect(failures.every((result) => result.status === 'rejected')).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await Promise.all(Array.from({ length: 10 }, () => provider.getToken()))).toEqual(Array(10).fill(token.access_token));
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([400, 401, 403, 429, 500])('classifies token HTTP %s without disclosing provider body', async (status) => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValue(json({ secret: config.appSecret }, status));
  const provider = createKisTokenProvider(createKisClient(config, fetcher), config);
  await expect(provider.getToken()).rejects.toMatchObject({ code: status < 429 ? 'authentication_error' : 'provider_unavailable' });
  await expect(provider.getToken()).rejects.not.toThrow(config.appSecret);
});
it.each([{}, { ...token, expires_in: '3600' }, { ...token, expires_in: 0 }, { ...token, token_type: 'other' }, { ...token, access_token: '' }, { ...token, access_token: 'token\n' }])('rejects malformed token %j', async (body) => {
  const fetcher = vi.fn<KisFetch>().mockImplementation(async () => json(body));
  await expect(createKisTokenProvider(createKisClient(config, fetcher), config).getToken()).rejects.toMatchObject({ code: 'provider_invalid_response' });
});
it('maps quote without float conversion or provider fields and uses official query/header', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(quote));
  const adapter = createKisBroker(config, fetcher, () => Date.UTC(2026, 8, 15));
  expect(await adapter.getQuote('005930')).toEqual({ symbol: '005930', price: '70000', change: '-1000', changeRate: '-1.41', volume: '9007199254740993', timestamp: '2026-09-15T00:00:00.000Z' });
  const [url, init] = fetcher.mock.calls[1]!;
  expect(String(url)).toBe(`${KIS_PAPER_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930`);
  expect(init).toMatchObject({ method: 'GET', headers: { tr_id: 'FHKST01010100', authorization: `Bearer ${token.access_token}` } });
});
it.each([{}, { rt_cd: '0', output: {} }, { ...quote, output: { ...quote.output, stck_prpr: 70000 } }, { ...quote, output: { ...quote.output, prdy_ctrt: 'NaN' } }])('rejects malformed quote %j', async (body) => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(body));
  await expect(createKisBroker(config, fetcher).getQuote('005930')).rejects.toMatchObject({ code: 'provider_invalid_response' });
});
it('invalidates rejected authentication without automatically retrying', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token))
    .mockResolvedValueOnce(json({ rt_cd: '1', msg_cd: 'EGW00123', msg1: config.appSecret }))
    .mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(quote));
  const adapter = createKisBroker(config, fetcher);
  await expect(adapter.getQuote('005930')).rejects.toMatchObject({ code: 'authentication_error' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  await adapter.getQuote('005930');
  expect(fetcher).toHaveBeenCalledTimes(4);
});
it('maps business failure, network failure and invalid JSON safely', async () => {
  for (const [response, code] of [[json({ rt_cd: '1', msg_cd: 'unknown', msg1: config.appSecret }), 'provider_unavailable'], [new Response('{'), 'provider_invalid_response']] as const) {
    const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(response);
    await expect(createKisBroker(config, fetcher).getQuote('005930')).rejects.toMatchObject({ code });
  }
  const fetcher = vi.fn<KisFetch>().mockRejectedValue(new Error(config.appSecret));
  await expect(createKisBroker(config, fetcher).getQuote('005930')).rejects.toMatchObject({ code: 'provider_unavailable' });
});
it('rejects unconfigured or non-paper origins and invalid symbols without network calls', async () => {
  const fetcher = vi.fn<KisFetch>();
  for (const badConfig of [{ baseUrl: KIS_PAPER_URL }, { ...config, baseUrl: 'https://example.com' }]) {
    const adapter = createKisBroker(badConfig, fetcher);
    expect(adapter.isConfigured()).toBe(false);
    await expect(adapter.getQuote('005930')).rejects.toMatchObject({ code: 'configuration_error' });
  }
  await expect(createKisBroker(config, fetcher).getQuote('abc')).rejects.toMatchObject({ code: 'invalid_symbol' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('bounds a stalled request to ten seconds and permits a subsequent token attempt', async () => {
  vi.useFakeTimers();
  // AbortSignal.timeout uses native timers; replace it with a deterministic abort signal.
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), milliseconds);
    return controller.signal;
  });
  const fetcher = vi.fn<KisFetch>().mockImplementationOnce(async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('fixture-secret')), { once: true });
  })).mockImplementation(async () => json(token));
  try {
    const provider = createKisTokenProvider(createKisClient(config, fetcher), config);
    const failed = expect(provider.getToken()).rejects.toMatchObject({ code: 'provider_unavailable' });
    await vi.advanceTimersByTimeAsync(10_000);
    await failed;
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(await provider.getToken()).toBe(token.access_token);
  } finally { timeout.mockRestore(); vi.useRealTimers(); }
});
it('does not evict a new token when an older concurrent request fails', async () => {
  let now = 0;
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token))
    .mockResolvedValueOnce(json({ ...token, access_token: 'new-token' }));
  const provider = createKisTokenProvider(createKisClient(config, fetcher), config, () => now);
  await provider.getToken();
  now = 3_600_000;
  await provider.getToken();
  provider.invalidate(token.access_token);
  expect(await provider.getToken()).toBe('new-token');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
