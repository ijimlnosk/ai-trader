import type { FastifyInstance } from 'fastify';
import type { PortfolioResponse } from '@ai-trader/contracts';
import type { createPortfolioQuery } from '../../application/portfolio.ts';
import { registerBrokerErrorHandler } from './brokerErrors.ts';

export function registerPortfolioRoute(app: FastifyInstance, getPortfolio: ReturnType<typeof createPortfolioQuery>) {
  app.register(async (routes) => {
    registerBrokerErrorHandler(routes, 'portfolio_request_failed');
    routes.get<{ Reply: PortfolioResponse }>('/api/v1/portfolio', async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return getPortfolio();
    });
  });
}
