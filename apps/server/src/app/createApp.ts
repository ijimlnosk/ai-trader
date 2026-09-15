import Fastify from 'fastify';
import { createMarket, type MarketBroker } from '../application/market.ts';
import { createKisQuoteAdapter } from '../infrastructure/broker/kis/index.ts';
import { registerMarketRoutes } from '../interfaces/http/market.ts';
import { createHealthCheck, type DatabaseHealth } from '../application/health.ts';
import { PaperBroker } from '../infrastructure/broker/paper/index.ts';
import { registerHealthRoute } from '../interfaces/http/health.ts';
import type { Environment } from './environment.ts';

export function createApp(environment: Environment, database: DatabaseHealth, logger: boolean | { write(chunk: string): void } = true, marketBroker?: MarketBroker) {
  if (environment.BROKER_MODE !== 'paper') {
    throw new Error('Live broker is not implemented; BROKER_MODE must be paper');
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
  const broker = marketBroker ?? createKisQuoteAdapter({
    baseUrl: environment.KIS_BASE_URL,
    appKey: environment.KIS_APP_KEY,
    appSecret: environment.KIS_APP_SECRET,
  });
  registerMarketRoutes(app, createMarket(broker));
  return app;
}
