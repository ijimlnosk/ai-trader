import { createRiskEvaluation, type RiskContextProvider } from '../application/risk.ts';
import { registerRiskRoute } from '../interfaces/http/risk.ts';
import Fastify from 'fastify';
import { createPortfolioQuery, type AccountBroker } from '../application/portfolio.ts';
import { registerPortfolioRoute } from '../interfaces/http/portfolio.ts';
import { createMarket, type MarketBroker } from '../application/market.ts';
import { registerMarketRoutes } from '../interfaces/http/market.ts';
import { createHealthCheck, type DatabaseHealth } from '../application/health.ts';
import { PaperBroker } from '../infrastructure/broker/paper/index.ts';
import { registerHealthRoute } from '../interfaces/http/health.ts';
import type { Environment } from './environment.ts';

export function createApp(
  environment: Environment, database: DatabaseHealth,
  dependencies: { marketBroker: MarketBroker; accountBroker: AccountBroker; riskContextProvider: RiskContextProvider },
  logger: boolean | { write(chunk: string): void } = true,
) {
  if (environment.BROKER_MODE !== 'paper') {
    throw new Error('Live broker is not implemented; BROKER_MODE must be paper');
  }
  if (!dependencies?.riskContextProvider || typeof dependencies.riskContextProvider.getRiskContext !== 'function') {
    throw new Error('RiskContextProvider is required');
  }
  const app = Fastify({
    logger: logger ? {
      level: 'info',
      ...(typeof logger === 'object' ? { stream: logger } : {}),
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      serializers: { req: (request: { method: string }) => ({ method: request.method }) },
    } : false,
  });
  registerHealthRoute(app, createHealthCheck(database, new PaperBroker()));
  registerMarketRoutes(app, createMarket(dependencies.marketBroker));
  registerPortfolioRoute(app, createPortfolioQuery(dependencies.accountBroker));
  registerRiskRoute(app, createRiskEvaluation(dependencies.riskContextProvider));
  return app;
}
