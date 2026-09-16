import { setTimeout as delay } from 'node:timers/promises';
import type { OrderBroker } from '../../../application/orders/ports.ts';
import type { BrokerFill } from '../../../domain/orders.ts';
import { parseRiskDecimal } from '../../../domain/risk/index.ts';
import { BrokerError } from '../../../application/brokerError.ts';
import type { KisConfiguration } from './kisClient.ts';
import type { KisSession } from './kisSession.ts';
import { accountSchema } from './kisPortfolioSchemas.ts';
import { brokerId, fillPageSchema } from './kisOrderSchemas.ts';
import { parseKis } from './kisSchemas.ts';

export function createKisOrderFillQuery(config: KisConfiguration, session: KisSession): OrderBroker['getOrderFill'] {
  return async (order, id) => {
    const account = parseKis(accountSchema, config);
    parseKis(brokerId, id);
    if (!order.brokerOrderDate) throw new BrokerError('provider_invalid_response');
    let fk = ''; let nk = ''; let found: BrokerFill | null = null;
    const cursors = new Set<string>();
    for (let page = 0; page < 20; page++) {
      if (page > 0) await delay(1000);
      const query = new URLSearchParams({ CANO: account.accountNo, ACNT_PRDT_CD: account.accountProductCode,
        INQR_STRT_DT: order.brokerOrderDate, INQR_END_DT: order.brokerOrderDate, SLL_BUY_DVSN_CD: '00',
        PDNO: order.symbol, CCLD_DVSN: '00', INQR_DVSN: '00', INQR_DVSN_3: '00', ORD_GNO_BRNO: '',
        ODNO: id, INQR_DVSN_1: '', CTX_AREA_FK100: fk, CTX_AREA_NK100: nk, EXCG_ID_DVSN_CD: 'KRX' });
      const response = await session.get(`/uapi/domestic-stock/v1/trading/inquire-daily-ccld?${query}`, 'VTTC0081R', page ? 'N' : '');
      const data = parseKis(fillPageSchema, response.body);
      for (const row of data.output1) {
        if (BigInt(row.odno) !== BigInt(id)) continue;
        if (found) throw new BrokerError('provider_invalid_response');
        const quantity = BigInt(row.ord_qty); const filled = BigInt(row.tot_ccld_qty); const rejected = BigInt(row.rjct_qty);
        if (quantity <= 0n || filled > quantity || rejected > quantity || (filled > 0n && parseRiskDecimal(row.tot_ccld_amt) === 0n)) {
          throw new BrokerError('provider_invalid_response');
        }
        found = { brokerOrderId: id, orderDate: row.ord_dt, symbol: row.pdno,
          side: row.sll_buy_dvsn_cd === '02' ? 'BUY' : 'SELL', quantity: row.ord_qty,
          filledQuantity: row.tot_ccld_qty, filledAmount: row.tot_ccld_amt,
          status: filled === quantity ? 'FILLED' : row.cncl_yn === 'Y' ? 'CANCELLED'
            : rejected === quantity && filled === 0n ? 'BROKER_REJECTED' : filled > 0n ? 'PARTIALLY_FILLED' : 'SUBMITTED' };
      }
      const continuation = response.continuation?.trim();
      if (continuation === '' || continuation === 'D' || continuation === 'E') return found;
      if (!['F', 'M'].includes(continuation ?? '')) throw new BrokerError('provider_invalid_response');
      fk = data.ctx_area_fk100 ?? ''; nk = data.ctx_area_nk100 ?? '';
      const cursor = JSON.stringify([fk, nk]);
      if ((!fk.trim() && !nk.trim()) || cursors.has(cursor)) throw new BrokerError('provider_invalid_response');
      cursors.add(cursor);
    }
    throw new BrokerError('provider_invalid_response');
  };
}
