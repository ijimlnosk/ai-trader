import { expect, it, vi } from 'vitest';
import { createKisBroker, KIS_PAPER_URL } from './index.ts';
import type { KisFetch } from './kisClient.ts';
import { memoryOrders, input } from '../../../../test/orderFixtures.ts';

const config = { baseUrl: KIS_PAPER_URL, appKey: 'fixture-key', appSecret: 'fixture-secret', accountNo: '12345678', accountProductCode: '01' };
const token = { access_token: 'fixture-token', token_type: 'Bearer', expires_in: 3600 };
const receipt = { rt_cd: '0', output: { ODNO: '00012345', KRX_FWDG_ORD_ORGNO: '00950', ORD_TMD: '100000' } };
const json = (body: unknown, continuation = 'D') => new Response(JSON.stringify(body), { headers: { tr_cont: continuation } });
it.each([['BUY', 'VTTC0012U', ''], ['SELL', 'VTTC0011U', '01']] as const)('submits one official paper %s MARKET request using %s', async (side, trId, sellType) => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json(receipt));
  const broker = createKisBroker(config, fetcher);
  expect(await broker.submitOrder({ orderId: 'local-order', symbol: '005930', side, quantity: '1', orderType: 'MARKET' }))
    .toEqual({ accepted: true, brokerOrderId: '12345' });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [url, init] = fetcher.mock.calls[1]!;
  expect(String(url)).toBe(`${KIS_PAPER_URL}/uapi/domestic-stock/v1/trading/order-cash`);
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { tr_id: trId } });
  expect(JSON.parse(String(init?.body))).toEqual({ CANO: '12345678', ACNT_PRDT_CD: '01', PDNO: '005930',
    ORD_DVSN: '01', ORD_QTY: '1', ORD_UNPR: '0', EXCG_ID_DVSN_CD: 'KRX', SLL_TYPE: sellType, CNDT_PRIC: '' });
});
it('an explicit rejection is distinguishable from an unknown transmission outcome', async () => {
  const diagnostic = vi.fn();
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ rt_cd: '1', msg_cd: 'APBK0919', msg1: '12345678 fixture-secret fixture-token' }));
  expect(await createKisBroker(config, fetcher, Date.now, diagnostic).submitOrder({ orderId: 'local', ...input })).toEqual({ accepted: false });
  expect(diagnostic).toHaveBeenCalledWith({ provider: 'kis', operation: 'order_cash', transactionId: 'VTTC0012U', httpStatus: 200, msgCode: 'APBK0919' });
  expect(JSON.stringify(diagnostic.mock.calls)).not.toMatch(/12345678|fixture-secret|fixture-token|msg1/);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each(['timeout', 'invalid_response', 'http500'])('never retries an ambiguous %s order POST', async (kind) => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token));
  if (kind === 'timeout') fetcher.mockRejectedValueOnce(new DOMException('private-secret', 'TimeoutError'));
  else fetcher.mockResolvedValueOnce(kind === 'http500' ? new Response('private-secret', { status: 500 }) : json({ rt_cd: '0', output: {} }));
  await expect(createKisBroker(config, fetcher).submitOrder({ orderId: 'local', ...input })).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('validates paper URL and whole shares before posting', async () => {
  const fetcher = vi.fn<KisFetch>();
  for (const quantity of ['0', '1.5', '-1']) {
    await expect(createKisBroker(config, fetcher).submitOrder({ orderId: 'local', ...input, quantity })).rejects.toThrow();
  }
  await expect(createKisBroker({ ...config, baseUrl: 'https://example.com' }, fetcher).submitOrder({ orderId: 'local', ...input })).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it('queries non-margin buying power with the market-order mode and no overseas funds', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ rt_cd: '0', output: { nrcvb_buy_amt: '10000000', nrcvb_buy_qty: '100' } }));
  expect(await createKisBroker(config, fetcher).getBuyingPower('005930', '70000')).toEqual({ cash: '10000000', quantity: '100' });
  const [url, init] = fetcher.mock.calls[1]!;
  expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({ CANO: '12345678', ACNT_PRDT_CD: '01', PDNO: '005930', ORD_UNPR: '70000',
    ORD_DVSN: '01', CMA_EVLU_AMT_ICLD_YN: 'N', OVRS_ICLD_YN: 'N' });
  expect(init).toMatchObject({ headers: { tr_id: 'VTTC8908R' } });
});
it('queries an accepted paper order and maps cumulative fills', async () => {
  const fetcher = vi.fn<KisFetch>().mockResolvedValueOnce(json(token)).mockResolvedValueOnce(json({ rt_cd: '0', output1: [{
    odno: '00012345', ord_dt: '20260916', pdno: '005930', sll_buy_dvsn_cd: '02', ord_dvsn_cd: '01',
    ord_qty: '1', tot_ccld_qty: '1', tot_ccld_amt: '70000', cncl_yn: 'N', rjct_qty: '0',
  }] }));
  const { order } = await memoryOrders().repository.reserve('key', input); order.brokerOrderDate = '20260916';
  expect(await createKisBroker(config, fetcher).getOrderFill(order, '12345')).toMatchObject({ brokerOrderId: '12345', status: 'FILLED', filledQuantity: '1', filledAmount: '70000' });
  const [url, init] = fetcher.mock.calls[1]!;
  expect(new URL(String(url)).pathname).toBe('/uapi/domestic-stock/v1/trading/inquire-daily-ccld');
  expect(new URL(String(url)).searchParams.get('ODNO')).toBe('12345');
  expect(init).toMatchObject({ headers: { tr_id: 'VTTC0081R' } });
});
