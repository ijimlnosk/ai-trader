import { expect, it, vi } from 'vitest';
import { KIS_PAPER_URL, type KisFetch } from './kisClient.ts';
import { createKisBroker } from './index.ts';

const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret' };
const token = { access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 };
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const bar = (time: string, date = '20261001') => ({ stck_bsop_date: date, stck_cntg_hour: time, stck_prpr: '269500',
  stck_oprc: '269000', stck_hgpr: '269500', stck_lwpr: '268500', cntg_vol: '38701', acml_tr_pbmn: '846513187000' });
const body = { rt_cd: '0', output1: { stck_prpr: '269500' }, output2: [bar('100000'), bar('095900')] };

function broker(response: unknown) {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(response));
  return { fetcher, adapter: createKisBroker(config, fetcher) };
}

it('requests one page of today minute bars and maps them with provenance', async () => {
  const { fetcher, adapter } = broker(body);
  const page = await adapter.getMinuteBars('005930', '100000');
  expect(page).toMatchObject({ date: '20261001', source: 'KIS FHKST03010200 J minute raw', bars: [
    { time: '100000', open: '269000', high: '269500', low: '268500', close: '269500', volume: '38701' },
    { time: '095900', open: '269000', high: '269500', low: '268500', close: '269500', volume: '38701' }] });
  const [url, init] = fetcher.mock.calls[1]!;
  expect(String(url)).toBe(`${KIS_PAPER_URL}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice?`
    + 'FID_ETC_CLS_CODE=&FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=005930&FID_INPUT_HOUR_1=100000&FID_PW_DATA_INCU_YN=N');
  expect(init).toMatchObject({ method: 'GET', headers: { tr_id: 'FHKST03010200' } });
});

it.each([
  ['mixed dates', { ...body, output2: [bar('100000'), bar('095900', '20260930')] }],
  ['duplicate time', { ...body, output2: [bar('100000'), bar('100000')] }],
  ['bar after requested time', { ...body, output2: [bar('100100')] }],
  ['decimal price', { ...body, output2: [{ ...bar('100000'), stck_prpr: '1.5' }] }],
  ['missing list', { rt_cd: '0' }],
])('rejects %s', async (_name, response) => {
  await expect(broker(response).adapter.getMinuteBars('005930', '100000')).rejects.toMatchObject({ code: 'provider_invalid_response' });
});

it('returns an empty page and rejects invalid input before any request', async () => {
  expect((await broker({ rt_cd: '0', output2: [{}] }).adapter.getMinuteBars('005930', '100000')).bars).toEqual([]);
  const { fetcher, adapter } = broker(body);
  await expect(adapter.getMinuteBars('5930', '100000')).rejects.toMatchObject({ code: 'invalid_symbol' });
  await expect(adapter.getMinuteBars('005930', '10:00')).rejects.toMatchObject({ code: 'provider_invalid_response' });
  expect(fetcher).not.toHaveBeenCalled();
});
