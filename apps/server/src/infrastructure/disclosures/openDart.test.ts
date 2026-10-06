import { describe, expect, it, vi } from 'vitest';
import { createOpenDartSource } from './openDart.ts';

const item = { corp_code: '00126380', corp_name: '삼성전자', stock_code: '005930', corp_cls: 'Y', report_nm: '주요사항보고서(자기주식취득결정)',
  rcept_no: '20261002000123', flr_nm: '삼성전자', rcept_dt: '20261002', rm: '유' };
const reply = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('OpenDART source', () => {
  it('maps a page and sends the range without exposing the key in results', async () => {
    const fetcher = reply({ status: '000', total_page: 8, list: [item] });
    const page = await createOpenDartSource({ apiKey: 'secret-key' }, fetcher).listPage('20260929', '20261006', 2);
    expect(page).toEqual({ totalPages: 8, items: [{ receiptNo: '20261002000123', corpCode: '00126380', corpName: '삼성전자', stockCode: '005930',
      corpClass: 'Y', reportName: '주요사항보고서(자기주식취득결정)', filerName: '삼성전자', receiptDate: '20261002', remarks: '유' }] });
    const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ bgn_de: '20260929', end_de: '20261006', page_no: '2', page_count: '100' });
  });

  it('accepts alphanumeric KRX codes of newer listings', async () => {
    const page = await createOpenDartSource({ apiKey: 'k' }, reply({ status: '000', total_page: 1, list: [{ ...item, stock_code: '0099X0' }] }))
      .listPage('20260929', '20261006', 1);
    expect(page.items[0]!.stockCode).toBe('0099X0');
  });

  it('treats status 013 as no filings', async () => {
    expect(await createOpenDartSource({ apiKey: 'k' }, reply({ status: '013', message: '조회된 데이타가 없습니다.' })).listPage('20261005', '20261005', 1))
      .toEqual({ items: [], totalPages: 0 });
  });

  it.each([
    ['provider error', { status: '020', message: '요청 제한' }, 200, 'dart_status_020'],
    ['HTTP error', {}, 500, 'dart_http_500'],
    ['malformed item', { status: '000', total_page: 1, list: [{ ...item, rcept_no: 'x' }] }, 200, 'dart_invalid_response'],
    ['filing outside the range', { status: '000', total_page: 1, list: [{ ...item, rcept_dt: '20260901' }] }, 200, 'dart_invalid_response'],
  ])('rejects a %s without the key in the message', async (_name, body, status, message) => {
    const error = await createOpenDartSource({ apiKey: 'secret-key' }, reply(body, status)).listPage('20260929', '20261006', 1).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(message);
  });

  it('rejects invalid requests before calling the provider', async () => {
    const fetcher = reply({});
    await expect(createOpenDartSource({ apiKey: 'k' }, fetcher).listPage('20261006', '20260929', 1)).rejects.toThrow('dart_invalid_request');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
