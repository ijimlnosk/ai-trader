import type { OrderBroker } from '../../../application/orders/ports.ts';
import { BrokerOrderRejected } from '../../../application/orders/ports.ts';
import { BrokerError } from '../../../application/brokerError.ts';
import type { KisConfiguration } from './kisClient.ts';
import { KIS_PAPER_URL } from './kisClient.ts';
import type { KisSession } from './kisSession.ts';
import { accountSchema } from './kisPortfolioSchemas.ts';
import { parseKis } from './kisSchemas.ts';
import { orderReceiptSchema, buyingPowerSchema } from './kisOrderSchemas.ts';
import { createKisOrderFillQuery } from './kisOrderFillQuery.ts';
import { orderInputSchema } from '../../../application/orders/input.ts';

export function createKisOrderAdapter(config: KisConfiguration, session: KisSession): OrderBroker {
  const account = () => {
    if (config.baseUrl !== KIS_PAPER_URL) throw new BrokerError('configuration_error');
    return parseKis(accountSchema, config);
  };
  return {
    async getBuyingPower(symbol, estimatedPrice) {
      const ids = account();
      const query = new URLSearchParams({ CANO: ids.accountNo, ACNT_PRDT_CD: ids.accountProductCode,
        PDNO: symbol, ORD_UNPR: estimatedPrice, ORD_DVSN: '01', CMA_EVLU_AMT_ICLD_YN: 'N', OVRS_ICLD_YN: 'N' });
      const response = await session.get(`/uapi/domestic-stock/v1/trading/inquire-psbl-order?${query}`, 'VTTC8908R');
      const { output } = parseKis(buyingPowerSchema, response.body);
      return { cash: output.nrcvb_buy_amt, quantity: output.nrcvb_buy_qty };
    },
    async submitOrder(request) {
      const ids = account();
      // Defense at the write adapter: no fractional shares, arbitrary order modes or symbols.
      orderInputSchema.parse({ symbol: request.symbol, side: request.side, quantity: request.quantity,
        orderType: request.orderType, confidence: '1' });
      try {
        const response = await session.postOrder(request.side === 'BUY' ? 'VTTC0012U' : 'VTTC0011U', {
          CANO: ids.accountNo, ACNT_PRDT_CD: ids.accountProductCode, PDNO: request.symbol,
          ORD_DVSN: '01', ORD_QTY: request.quantity, ORD_UNPR: '0', EXCG_ID_DVSN_CD: 'KRX',
          SLL_TYPE: request.side === 'SELL' ? '01' : '', CNDT_PRIC: '',
        });
        return { accepted: true, brokerOrderId: parseKis(orderReceiptSchema, response.body).output.ODNO };
      } catch (error) {
        if (error instanceof BrokerOrderRejected) return { accepted: false };
        throw error; // Transport/malformed acknowledgement remains ambiguous; never retry.
      }
    },
    getOrderFill: createKisOrderFillQuery(config, session),
  };
}
