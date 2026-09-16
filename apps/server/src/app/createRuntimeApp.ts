import type { DatabaseHealth } from '../application/health.ts';
import type { MarketBroker } from '../application/market.ts';
import type { AccountBroker } from '../application/portfolio.ts';
import { createPaperPortfolioRiskContextProvider } from '../application/paperRiskContext.ts';
import { createKisBroker } from '../infrastructure/broker/kis/index.ts';
import { createApp } from './createApp.ts';
import type { Environment } from './environment.ts';

/** Production composition; optional broker ports allow the same wiring to run without networking in tests. */
export function createRuntimeApp(
  environment: Environment, database: DatabaseHealth,
  logger: boolean | { write(chunk: string): void } = true,
  marketBroker?: MarketBroker, accountBroker?: AccountBroker,
) {
  if (environment.BROKER_MODE !== 'paper') throw new Error('Live broker is not implemented');
  const broker = createKisBroker({
    baseUrl: environment.KIS_BASE_URL,
    appKey: environment.KIS_APP_KEY,
    appSecret: environment.KIS_APP_SECRET,
    accountNo: environment.KIS_ACCOUNT_NO,
    accountProductCode: environment.KIS_ACCOUNT_PRODUCT_CODE,
  }, undefined, Date.now, (event) => app.log.warn(event, 'KIS balance request rejected'));
  const account = accountBroker ?? broker;
  // Diagnostics run only on requests, after app construction has completed.
  const app = createApp(environment, database, {
    marketBroker: marketBroker ?? broker,
    accountBroker: account,
    riskContextProvider: createPaperPortfolioRiskContextProvider(account),
  }, logger);
  return app;
}
