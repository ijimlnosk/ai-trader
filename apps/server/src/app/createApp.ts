import type { AuthService } from '../application/auth/index.ts';
import { registerAuthRoutes } from '../interfaces/http/auth.ts';
import { registerUserConsole } from '../interfaces/http/userConsole.ts';
import { protectBrokerReads } from '../interfaces/http/readAuthorization.ts';
import { createPaperLoop } from '../application/paperLoop/index.ts';
import type { PaperLoopRepository } from '../application/paperLoop/ports.ts';
import { registerPaperLoopRoute } from '../interfaces/http/paperLoop.ts';
import { readPaperLoopTask } from '../infrastructure/market/paperLoopTask.ts';
import { startPaperLoopTrigger } from './paperLoopTrigger.ts';
import { createStrategyService } from '../application/strategy/index.ts';
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
import type { OrderServices } from '../application/orders/index.ts';
import { registerOrderRoutes } from '../interfaces/http/orders.ts';
import { createMemoryStrategyRunRepository, createStrategyScheduler } from '../application/scheduler/index.ts';
import { registerStrategySchedulerRoute } from '../interfaces/http/strategyScheduler.ts';
import type { StrategyRunRepository } from '../application/scheduler/index.ts';
import type { DailyHistorySource, DailySnapshotRepository } from '../application/marketData/ports.ts';
import { createDailySnapshotCollector } from '../application/marketData/collect.ts';
import { createPaperLoopPreparer } from '../application/paperLoop/prepare.ts';
import { registerMarketDataRoutes } from '../interfaces/http/marketData.ts';
import { createDailySchedule } from '../application/paperLoop/dailySchedule.ts';
import { startDailyScheduleTimer } from './dailyScheduleTimer.ts';
import { createConsoleQueries, type ConsoleReadRepository } from '../application/console/index.ts';
import { registerConsoleRoutes } from '../interfaces/http/console.ts';

export function createApp(
  environment: Environment, database: DatabaseHealth,
  dependencies: { marketBroker: MarketBroker; accountBroker: AccountBroker; riskContextProvider: RiskContextProvider; orders?: OrderServices | undefined; strategyRuns?: StrategyRunRepository; paperLoopRuns?: PaperLoopRepository;
    dailyHistory?: DailyHistorySource; dailySnapshots?: DailySnapshotRepository; consoleRead?: ConsoleReadRepository; auth?: AuthService; executionAccount?: string },
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
  app.register(async reads => {
    protectBrokerReads(reads, [environment.CONSOLE_READ_TOKEN, environment.ORDER_API_TOKEN]);
    registerMarketRoutes(reads, createMarket(dependencies.marketBroker));
    registerPortfolioRoute(reads, createPortfolioQuery(dependencies.accountBroker));
    registerRiskRoute(reads, createRiskEvaluation(dependencies.riskContextProvider));
  });
  const strategy = createStrategyService({
    account: dependencies.accountBroker, risk: dependencies.riskContextProvider, orders: dependencies.orders,
  });
  registerOrderRoutes(app, dependencies.orders, environment.ORDER_API_TOKEN, strategy);
  registerStrategySchedulerRoute(app, createStrategyScheduler({ strategy, runs: dependencies.strategyRuns ?? createMemoryStrategyRunRepository() }), environment.ORDER_API_TOKEN);
  const tick = dependencies.paperLoopRuns && dependencies.orders ? createPaperLoop({
    repository: dependencies.paperLoopRuns, orders: dependencies.orders, strategy,
    enabled: environment.PAPER_LOOP_ENABLED, executionEnabled: environment.PAPER_ORDER_EXECUTION_ENABLED,
  }) : undefined;
  registerPaperLoopRoute(app, tick, environment.ORDER_API_TOKEN);
  const snapshots = dependencies.dailySnapshots;
  const collect = snapshots && dependencies.dailyHistory ? createDailySnapshotCollector({ history: dependencies.dailyHistory, snapshots }) : undefined;
  const prepare = snapshots ? createPaperLoopPreparer({ snapshots }) : undefined;
  registerMarketDataRoutes(app, { apiToken: environment.ORDER_API_TOKEN, collect, prepare });
  const consoleQueries = dependencies.consoleRead ? createConsoleQueries({ repository: dependencies.consoleRead, flags: {
    tradingMode: environment.BROKER_MODE, liveTradingEnabled: environment.LIVE_TRADING_ENABLED,
    paperExecutionEnabled: environment.PAPER_ORDER_EXECUTION_ENABLED, paperLoopEnabled: environment.PAPER_LOOP_ENABLED,
    killSwitchEnabled: environment.TRADING_KILL_SWITCH_ENABLED, marketDataScheduleEnabled: environment.MARKET_DATA_SCHEDULE_ENABLED,
    paperLoopScheduleEnabled: environment.PAPER_LOOP_SCHEDULE_ENABLED } }) : undefined;
  registerConsoleRoutes(app, consoleQueries, environment.CONSOLE_READ_TOKEN);
  registerAuthRoutes(app, dependencies.auth, dependencies.executionAccount ?? '');
  registerUserConsole(app, { auth: dependencies.auth, account: dependencies.executionAccount ?? '', queries: consoleQueries,
    portfolio: createPortfolioQuery(dependencies.accountBroker), market: createMarket(dependencies.marketBroker),
    health: createHealthCheck(database, new PaperBroker()) });
  if (environment.MARKET_DATA_SCHEDULE_ENABLED || environment.PAPER_LOOP_SCHEDULE_ENABLED) {
    if ((environment.MARKET_DATA_SCHEDULE_ENABLED && !collect) || (environment.PAPER_LOOP_SCHEDULE_ENABLED && (!prepare || !tick))) {
      throw new Error('Daily schedule dependencies required');
    }
    const report = (event: string, detail?: Record<string, string>) => app.log.info({ event, ...detail }, 'Daily schedule');
    const step = createDailySchedule({ report,
      collect: environment.MARKET_DATA_SCHEDULE_ENABLED ? collect : undefined,
      loop: environment.PAPER_LOOP_SCHEDULE_ENABLED && prepare && tick ? { prepare, tick } : undefined });
    let stop: (() => Promise<void>) | undefined;
    app.addHook('onReady', async () => { stop = startDailyScheduleTimer(step, (event) => app.log.error({ event }, 'Daily schedule')); });
    app.addHook('preClose', async () => { await stop?.(); });
  }
  if (environment.PAPER_LOOP_ENABLED && environment.PAPER_LOOP_TASK_FILE) {
    if (!tick) throw new Error('Paper loop repository required');
    let stop: (() => Promise<void>) | undefined;
    app.addHook('onReady', async () => {
      const task = await readPaperLoopTask(environment.PAPER_LOOP_TASK_FILE!);
      stop = startPaperLoopTrigger(tick, task, event => app.log.info({ event }, 'Paper loop tick'));
    });
    app.addHook('preClose', async () => { await stop?.(); });
  }
  return app;
}
