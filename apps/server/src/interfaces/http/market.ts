import type { QuoteResponse } from '@ai-trader/contracts';
import type { FastifyInstance } from 'fastify';
import type { createMarket } from '../../application/market.ts';
import { BrokerError, type BrokerErrorCode } from '../../application/brokerError.ts';

const statusCodes: Record<BrokerErrorCode, number> = {
  invalid_symbol: 400, configuration_error: 503, authentication_error: 502,
  provider_unavailable: 503, provider_invalid_response: 502,
};
export function registerMarketRoutes(app: FastifyInstance, market: ReturnType<typeof createMarket>) {
  // Scoped handler prevents raw provider exceptions from reaching Fastify's error logger.
  app.register(async (routes) => {
    routes.setErrorHandler((error, request, reply) => {
      const known = error instanceof BrokerError;
      const code = known ? error.code : 'internal_error';
      request.log.warn({ event: 'market_request_failed', code }, 'Market request failed');
      return reply.code(known ? statusCodes[error.code] : 500).send({
        error: { code, message: known ? error.message : 'Internal server error' },
      });
    });
    routes.get('/api/v1/broker/status', async () => market.getStatus());
    routes.get<{ Params: { symbol: string }; Reply: QuoteResponse }>('/api/v1/market/:symbol/quote', async (request) => {
      return market.getQuote(request.params.symbol);
    });
  });
}
