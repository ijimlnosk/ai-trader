import type { AuthService } from '../application/auth/index.ts';
import type { MinuteBarRepository } from '../application/marketData/minuteBars.ts';
import type { IntradaySignalRepository } from '../application/strategy/takeProfitWatch.ts';
import type { DisclosureRepository } from '../application/disclosures/ports.ts';
import { createOpenDartSource } from '../infrastructure/disclosures/openDart.ts';
import type { TradingControlRepository } from '../application/controls/index.ts';
import type { ApiQuota, NewsRepository } from '../application/news/ports.ts';
import { createNaverNewsSearch } from '../infrastructure/news/naverNews.ts';
import { createClaudeNewsAssessor } from '../infrastructure/ai/claudeNewsAssessor.ts';
import type { AssessmentRepository } from '../application/analysis/screen.ts';
import type { PaperLoopRepository } from '../application/paperLoop/ports.ts';
import type { DatabaseHealth } from '../application/health.ts';
import type { MarketBroker } from '../application/market.ts';
import type { AccountBroker } from '../application/portfolio.ts';
import { createPaperPortfolioRiskContextProvider } from '../application/paperRiskContext.ts';
import { createKisBroker } from '../infrastructure/broker/kis/index.ts';
import { createApp } from './createApp.ts';
import type { Environment } from './environment.ts';
import { createOrderServices } from '../application/orders/index.ts';
import type { OrderRepository } from '../application/orders/ports.ts';
import type { StrategyRunRepository } from '../application/scheduler/index.ts';
import type { DailySnapshotRepository } from '../application/marketData/ports.ts';
import type { ConsoleReadRepository } from '../application/console/index.ts';

/** Production composition; optional broker ports allow the same wiring to run without networking in tests. */
export function createRuntimeApp(
  environment: Environment, database: DatabaseHealth,
  logger: boolean | { write(chunk: string): void } = true,
  marketBroker?: MarketBroker, accountBroker?: AccountBroker,
  orderRepository?: OrderRepository, strategyRunRepository?: StrategyRunRepository, paperLoopRepository?: PaperLoopRepository,
  dailySnapshotRepository?: DailySnapshotRepository, consoleReadRepository?: ConsoleReadRepository, auth?: AuthService, executionAccount?: string, tradingControls?: TradingControlRepository,
  newsRepository?: NewsRepository, apiQuota?: ApiQuota, assessments?: AssessmentRepository, minuteBarRepository?: MinuteBarRepository,
  intradaySignals?: IntradaySignalRepository, disclosures?: DisclosureRepository,
) {
  if (environment.BROKER_MODE !== 'paper') throw new Error('Live broker is not implemented');
  if (environment.PAPER_ORDER_EXECUTION_ENABLED && !orderRepository) throw new Error('OrderRepository is required for paper execution');
  if (environment.PAPER_LOOP_ENABLED && (!paperLoopRepository || !orderRepository)) throw new Error('Paper loop repository required');
  const broker = createKisBroker({
    baseUrl: environment.KIS_BASE_URL,
    appKey: environment.KIS_APP_KEY,
    appSecret: environment.KIS_APP_SECRET,
    accountNo: environment.KIS_ACCOUNT_NO,
    accountProductCode: environment.KIS_ACCOUNT_PRODUCT_CODE,
  }, undefined, Date.now, (event) => app.log.warn(event, 'KIS API request rejected'), 1500);
  const account = accountBroker ?? broker;
  // Diagnostics run only on requests, after app construction has completed.
  const app = createApp(environment, database, {
    ...(auth ? { auth } : {}),
    ...(tradingControls ? { tradingControls } : {}),
    ...(newsRepository ? { newsRepository } : {}), ...(apiQuota ? { apiQuota } : {}), ...(assessments ? { assessments } : {}),
    ...(environment.ANTHROPIC_API_KEY ? { newsAssessor: createClaudeNewsAssessor({ apiKey: environment.ANTHROPIC_API_KEY, model: environment.NEWS_ANALYSIS_MODEL, effort: 'low' }) } : {}),
    ...(environment.NAVER_CLIENT_ID && environment.NAVER_CLIENT_SECRET
      ? { newsSearch: createNaverNewsSearch({ clientId: environment.NAVER_CLIENT_ID, clientSecret: environment.NAVER_CLIENT_SECRET }) } : {}),
    ...(executionAccount ? { executionAccount } : {}),
    marketBroker: marketBroker ?? broker,
    accountBroker: account,
    riskContextProvider: createPaperPortfolioRiskContextProvider(account, orderRepository, environment.TRADING_KILL_SWITCH_ENABLED),
    ...(paperLoopRepository ? { paperLoopRuns: paperLoopRepository } : {}),
    ...(strategyRunRepository ? { strategyRuns: strategyRunRepository } : {}),
    ...(dailySnapshotRepository ? { dailySnapshots: dailySnapshotRepository, dailyHistory: broker } : {}),
    ...(consoleReadRepository ? { consoleRead: consoleReadRepository } : {}),
    ...(minuteBarRepository ? { minuteBars: minuteBarRepository, minuteBarSource: broker } : {}),
    ...(intradaySignals ? { intradaySignals } : {}),
    ...(disclosures ? { disclosures } : {}),
    ...(environment.DART_API_KEY ? { disclosureSource: createOpenDartSource({ apiKey: environment.DART_API_KEY }) } : {}),
    orders: orderRepository ? createOrderServices({ repository: orderRepository, market: marketBroker ?? broker,
      account, broker, enabled: environment.PAPER_ORDER_EXECUTION_ENABLED, killSwitchEnabled: environment.TRADING_KILL_SWITCH_ENABLED }) : undefined,
  }, logger);
  return app;
}
