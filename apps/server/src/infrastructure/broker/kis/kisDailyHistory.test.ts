import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { KIS_PAPER_URL, type KisFetch } from './kisClient.ts';
import { createKisBroker } from './index.ts';

const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret' };
const token = { access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 };
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const bar = (date: string, close = '270000') => ({ stck_bsop_date: date, stck_oprc: '284500', stck_hgpr: '285500',
  stck_lwpr: '270000', stck_clpr: close, acml_vol: '21346064', acml_tr_pbmn: '1', mod_yn: 'N' });
const body = { rt_cd: '0', output1: { stck_prpr: '272500' }, output2: [bar('20260928'), bar('20260923', '285500'), {}] };

function broker(response: unknown) {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(response));
  return { fetcher, adapter: createKisBroker(config, fetcher, () => Date.UTC(2026, 8, 29, 6, 40)) };
}

it('requests raw daily bars and maps them ascending with provenance', async () => {
  const { fetcher, adapter } = broker(body);
  const history = await adapter.getDailyHistory('005930', '20260430', '20260928');
  expect(history.candles).toEqual([
    { date: '20260923', open: '284500', high: '285500', low: '270000', close: '285500', volume: '21346064' },
    { date: '20260928', open: '284500', high: '285500', low: '270000', close: '270000', volume: '21346064' },
  ]);
  expect(history.retrievedAt).toBe('2026-09-29T06:40:00.000Z');
  expect(history.source).toBe('KIS FHKST03010100 J daily raw retrieved 2026-09-29T06:40:00.000Z');
  expect(history.rawSha256).toBe(createHash('sha256').update(JSON.stringify(body)).digest('hex'));
  const [url, init] = fetcher.mock.calls[1]!;
  expect(String(url)).toBe(`${KIS_PAPER_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?`
    + 'FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930&FID_INPUT_DATE_1=20260430&FID_INPUT_DATE_2=20260928'
    + '&FID_PERIOD_DIV_CODE=D&FID_ORG_ADJ_PRC=1');
  expect(init).toMatchObject({ method: 'GET', headers: { tr_id: 'FHKST03010100' } });
});

it.each([
  ['numeric price', { ...body, output2: [{ ...bar('20260928'), stck_clpr: 270000 }] }],
  ['decimal price', { ...body, output2: [{ ...bar('20260928'), stck_clpr: '270000.5' }] }],
  ['missing price', { ...body, output2: [{ stck_bsop_date: '20260928' }] }],
  ['missing list', { rt_cd: '0' }],
  ['duplicate date', { ...body, output2: [bar('20260928'), bar('20260928')] }],
  ['date after range', { ...body, output2: [bar('20260929')] }],
  ['date before range', { ...body, output2: [bar('20260429')] }],
])('rejects %s', async (_name, response) => {
  await expect(broker(response).adapter.getDailyHistory('005930', '20260430', '20260928'))
    .rejects.toMatchObject({ code: 'provider_invalid_response' });
});

it('rejects invalid symbols and ranges before any request', async () => {
  const { fetcher, adapter } = broker(body);
  await expect(adapter.getDailyHistory('5930', '20260430', '20260928')).rejects.toMatchObject({ code: 'invalid_symbol' });
  await expect(adapter.getDailyHistory('005930', '20260928', '20260430')).rejects.toMatchObject({ code: 'provider_invalid_response' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('returns an empty history when the provider has no bars', async () => {
  const history = await broker({ rt_cd: '0', output2: [{}, {}] }).adapter.getDailyHistory('005930', '20260430', '20260928');
  expect(history.candles).toEqual([]);
});

describe('paging', () => {
  // Weekday dates before `end`, newest first, as KIS lists them.
  function weekdays(end: string, count: number): string[] {
    const dates: string[] = [];
    for (let day = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6)}T00:00:00Z`); dates.length < count; day.setUTCDate(day.getUTCDate() - 1)) {
      if (day.getUTCDay() % 6 !== 0) dates.push(day.toISOString().slice(0, 10).replaceAll('-', ''));
    }
    return dates;
  }
  const page = (dates: string[]) => ({ rt_cd: '0', output2: dates.map((date) => bar(date)) });
  function pagedBroker(...pages: unknown[]) {
    const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token));
    for (const value of pages) fetcher.mockResolvedValueOnce(json(value));
    return { fetcher, adapter: createKisBroker(config, fetcher, () => Date.UTC(2026, 9, 5, 10)) };
  }
  const endDate = (url: unknown) => new URL(String(url)).searchParams.get('FID_INPUT_DATE_2');

  it('requests older pages until a short page and joins them ascending', async () => {
    const all = weekdays('20261002', 150);
    const first = page(all.slice(0, 100)); const second = page(all.slice(100));
    const { fetcher, adapter } = pagedBroker(first, second);
    const history = await adapter.getDailyHistory('005930', '20260102', '20261002');
    expect(history.candles.map((candle) => candle.date)).toEqual([...all].reverse());
    const beforeOldest = new Date(`${all[99]!.slice(0, 4)}-${all[99]!.slice(4, 6)}-${all[99]!.slice(6)}T00:00:00Z`);
    beforeOldest.setUTCDate(beforeOldest.getUTCDate() - 1);
    expect(fetcher.mock.calls.slice(1).map(([url]) => endDate(url))).toEqual(['20261002', beforeOldest.toISOString().slice(0, 10).replaceAll('-', '')]);
    expect(history.rawSha256).toBe(createHash('sha256').update(JSON.stringify([first, second])).digest('hex'));
  });

  it('stops when the oldest bar reaches the range start', async () => {
    const all = weekdays('20261002', 100);
    const { fetcher, adapter } = pagedBroker(page(all));
    const history = await adapter.getDailyHistory('005930', all.at(-1)!, '20261002');
    expect(history.candles).toHaveLength(100);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('stops after three full pages', async () => {
    const all = weekdays('20261002', 300);
    const { fetcher, adapter } = pagedBroker(page(all.slice(0, 100)), page(all.slice(100, 200)), page(all.slice(200)));
    const history = await adapter.getDailyHistory('005930', '20230101', '20261002');
    expect(history.candles).toHaveLength(300);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('rejects an older page that repeats or passes the requested end', async () => {
    const all = weekdays('20261002', 100);
    await expect(pagedBroker(page(all), page([all[99]!])).adapter.getDailyHistory('005930', '20260102', '20261002'))
      .rejects.toMatchObject({ code: 'provider_invalid_response' });
  });
});
