import type { MarketBroker } from '../../../application/market.ts';
import { BrokerError } from '../../../application/brokerError.ts';
import { createKisClient, type KisConfiguration, type KisFetch } from './kisClient.ts';
import { createKisTokenProvider } from './kisTokenProvider.ts';
import { envelopeSchema, parseKis, quoteSchema } from './kisSchemas.ts';

export function createKisQuoteAdapter(config: KisConfiguration, fetcher?: KisFetch, now = Date.now): MarketBroker {
  const client = createKisClient(config, fetcher);
  const tokens = createKisTokenProvider(client, config, now);
  return {
    isConfigured: client.isConfigured,
    async getQuote(symbol) {
      if (symbol.length !== 6 || !/^[0-9]{6}$/.test(symbol)) throw new BrokerError('invalid_symbol');
      const token = await tokens.getToken();
      try {
        const query = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol });
        const raw = await client.request(`/uapi/domestic-stock/v1/quotations/inquire-price?${query}`, {
          method: 'GET', headers: {
            'content-type': 'application/json', authorization: `Bearer ${token}`,
            appkey: config.appKey ?? '', appsecret: config.appSecret ?? '',
            tr_id: 'FHKST01010100', custtype: 'P',
          },
        });
        const envelope = parseKis(envelopeSchema, raw);
        if (envelope.rt_cd !== '0') {
          const authentication = ['EGW00121', 'EGW00123'].includes(envelope.msg_cd ?? '');
          throw new BrokerError(authentication ? 'authentication_error' : 'provider_unavailable');
        }
        const { output } = parseKis(quoteSchema, raw);
        return {
          symbol, price: output.stck_prpr, change: output.prdy_vrss,
          changeRate: output.prdy_ctrt, volume: output.acml_vol,
          timestamp: new Date(now()).toISOString(),
        };
      } catch (error) {
        if (error instanceof BrokerError && error.code === 'authentication_error') tokens.invalidate(token);
        throw error;
      }
    },
  };
}

export { KIS_PAPER_URL } from './kisClient.ts';
