import type { QuoteResponse } from '@ai-trader/contracts';
import type { FastifyInstance } from 'fastify';
import type { createMarket } from '../../application/market.ts';
import { registerBrokerErrorHandler } from './brokerErrors.ts';

export function registerMarketRoutes(app: FastifyInstance, market: ReturnType<typeof createMarket>) {
  // Scoped handler prevents raw provider exceptions from reaching Fastify's error logger.
  app.register(async (routes) => {
    registerBrokerErrorHandler(routes, 'market_request_failed');
    routes.get('/api/v1/broker/status', async () => market.getStatus());
    routes.get<{ Params: { symbol: string }; Reply: QuoteResponse }>('/api/v1/market/:symbol/quote', async (request) => {
      return market.getQuote(request.params.symbol);
    });
  });
}
