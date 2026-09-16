import type { MarketBroker } from '../../../application/market.ts';
import type { AccountBroker } from '../../../application/portfolio.ts';
import { BrokerError } from '../../../application/brokerError.ts';
import type { KisConfiguration, KisFetch } from './kisClient.ts';
import { createKisSession } from './kisSession.ts';
import { createKisPortfolioAdapter } from './kisPortfolioAdapter.ts';
import { parseKis, quoteSchema } from './kisSchemas.ts';
import type { KisDiagnosticSink } from './kisDiagnostics.ts';

export function createKisBroker(config: KisConfiguration, fetcher?: KisFetch, now = Date.now, diagnostic?: KisDiagnosticSink): MarketBroker & AccountBroker {
  const session = createKisSession(config, fetcher, now, diagnostic);
  return {
    isConfigured: session.isConfigured,
    ...createKisPortfolioAdapter(config, session),
    async getQuote(symbol) {
      if (symbol.length !== 6 || !/^[0-9]{6}$/.test(symbol)) throw new BrokerError('invalid_symbol');
      const query = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol });
      const response = await session.get(`/uapi/domestic-stock/v1/quotations/inquire-price?${query}`, 'FHKST01010100');
      const { output } = parseKis(quoteSchema, response.body);
      return {
        symbol, price: output.stck_prpr, change: output.prdy_vrss,
        changeRate: output.prdy_ctrt, volume: output.acml_vol,
        timestamp: new Date(now()).toISOString(),
      };
    },
  };
}

export { KIS_PAPER_URL } from './kisClient.ts';
