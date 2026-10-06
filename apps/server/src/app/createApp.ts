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
import { createTradingControls, type TradingControlRepository } from '../application/controls/index.ts';
import type { ApiQuota, NewsRepository, NewsSearch } from '../application/news/ports.ts';
import { createNewsCollector } from '../application/news/collect.ts';
import { createNewsQuery } from '../application/news/query.ts';
import { UNIVERSE, universeSymbols } from '../domain/market/universe.ts';
import { createUniverseDatasetBuilder } from '../application/marketData/universeDataset.ts';
import { createSessionPlanRunner } from '../application/strategy/sessionPlan.ts';
import { createMomentumPlanRunner } from '../application/strategy/momentumPlan.ts';
import { createMomentumExecutor } from '../application/strategy/momentumExecution.ts';
import { AI_COST_PROVIDER, createNewsScreener, type AssessmentRepository } from '../application/analysis/screen.ts';
import { seoulOrderDate } from '../domain/orders.ts';
import type { NewsAssessor } from '../application/analysis/ports.ts';
import { createMinuteBarCollector, type MinuteBarRepository, type MinuteBarSource } from '../application/marketData/minuteBars.ts';
import { createMinuteBarSchedule } from '../application/marketData/minuteSchedule.ts';
import { createTakeProfitWatch, type IntradaySignalRepository } from '../application/strategy/takeProfitWatch.ts';
import { createDisclosureCollector } from '../application/disclosures/collect.ts';
import type { DisclosureRepository, DisclosureSource } from '../application/disclosures/ports.ts';
import { createDisclosureSchedule } from '../application/disclosures/schedule.ts';

export function createApp(
  environment: Environment, database: DatabaseHealth,
  dependencies: { marketBroker: MarketBroker; accountBroker: AccountBroker; riskContextProvider: RiskContextProvider; orders?: OrderServices | undefined; strategyRuns?: StrategyRunRepository; paperLoopRuns?: PaperLoopRepository;
    dailyHistory?: DailyHistorySource; dailySnapshots?: DailySnapshotRepository; consoleRead?: ConsoleReadRepository; auth?: AuthService; executionAccount?: string;
    tradingControls?: TradingControlRepository; newsSearch?: NewsSearch; newsRepository?: NewsRepository; apiQuota?: ApiQuota;
    newsAssessor?: NewsAssessor; assessments?: AssessmentRepository; minuteBars?: MinuteBarRepository; minuteBarSource?: MinuteBarSource;
    intradaySignals?: IntradaySignalRepository; disclosureSource?: DisclosureSource; disclosures?: DisclosureRepository },
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
  const strategyScheduler = createStrategyScheduler({ strategy, runs: dependencies.strategyRuns ?? createMemoryStrategyRunRepository() });
  registerStrategySchedulerRoute(app, strategyScheduler, environment.ORDER_API_TOKEN);
  const tick = dependencies.paperLoopRuns && dependencies.orders ? createPaperLoop({
    repository: dependencies.paperLoopRuns, orders: dependencies.orders, strategy,
    enabled: environment.PAPER_LOOP_ENABLED, executionEnabled: environment.PAPER_ORDER_EXECUTION_ENABLED,
  }) : undefined;
  registerPaperLoopRoute(app, tick, environment.ORDER_API_TOKEN);
  const snapshots = dependencies.dailySnapshots;
  const collect = snapshots && dependencies.dailyHistory ? createDailySnapshotCollector({ history: dependencies.dailyHistory, snapshots }) : undefined;
  const prepare = snapshots ? createPaperLoopPreparer({ snapshots }) : undefined;
  registerMarketDataRoutes(app, { apiToken: environment.ORDER_API_TOKEN, collect, prepare });
  const aiCaps = { daily: Math.round(environment.AI_DAILY_BUDGET_USD * 1e6), monthly: Math.round(environment.AI_MONTHLY_BUDGET_USD * 1e6) };
  const aiUsage = dependencies.apiQuota && dependencies.newsAssessor ? async () => {
    const day = seoulOrderDate(new Date().toISOString());
    const used = await dependencies.apiQuota!.usage(AI_COST_PROVIDER, day, day.slice(0, 6));
    return { model: dependencies.newsAssessor!.model, dailyMicroUsd: used.daily, monthlyMicroUsd: used.monthly,
      dailyCapMicroUsd: aiCaps.daily, monthlyCapMicroUsd: aiCaps.monthly };
  } : undefined;
  const consoleQueries = dependencies.consoleRead ? createConsoleQueries({ repository: dependencies.consoleRead, assessments: dependencies.assessments, aiUsage, flags: {
    tradingMode: environment.BROKER_MODE, liveTradingEnabled: environment.LIVE_TRADING_ENABLED,
    paperExecutionEnabled: environment.PAPER_ORDER_EXECUTION_ENABLED, paperLoopEnabled: environment.PAPER_LOOP_ENABLED,
    killSwitchEnabled: environment.TRADING_KILL_SWITCH_ENABLED, marketDataScheduleEnabled: environment.MARKET_DATA_SCHEDULE_ENABLED,
    paperLoopScheduleEnabled: environment.PAPER_LOOP_SCHEDULE_ENABLED, momentumExecutionEnabled: environment.MOMENTUM_EXECUTION_ENABLED } }) : undefined;
  registerConsoleRoutes(app, consoleQueries, environment.CONSOLE_READ_TOKEN);
  registerAuthRoutes(app, dependencies.auth, dependencies.executionAccount ?? '');
  const controls = dependencies.tradingControls && dependencies.auth && dependencies.executionAccount ? createTradingControls({
    repository: dependencies.tradingControls, auth: dependencies.auth, account: dependencies.executionAccount,
    environmentAllows: environment.PAPER_ORDER_EXECUTION_ENABLED
      && ((environment.PAPER_LOOP_SCHEDULE_ENABLED && environment.PAPER_LOOP_ENABLED) || environment.MOMENTUM_EXECUTION_ENABLED),
  }) : undefined;
  const newsCaps = { daily: environment.NAVER_DAILY_CALL_CAP, monthly: environment.NAVER_MONTHLY_CALL_CAP };
  const news = dependencies.newsRepository ? createNewsQuery({ news: dependencies.newsRepository, quota: dependencies.apiQuota,
    provider: dependencies.newsSearch?.provider ?? 'naver-api-hub-news', caps: newsCaps }) : undefined;
  const collectNews = dependencies.newsSearch && dependencies.newsRepository && dependencies.apiQuota ? createNewsCollector({
    search: dependencies.newsSearch, quota: dependencies.apiQuota, news: dependencies.newsRepository, caps: newsCaps,
    symbols: UNIVERSE.symbols }) : undefined;
  registerUserConsole(app, { news, controls, auth: dependencies.auth, account: dependencies.executionAccount ?? '', queries: consoleQueries,
    portfolio: createPortfolioQuery(dependencies.accountBroker), market: createMarket(dependencies.marketBroker),
    health: createHealthCheck(database, new PaperBroker()) });
  const universeDataset = snapshots ? createUniverseDatasetBuilder({ snapshots, symbols: universeSymbols(), label: UNIVERSE.version }) : undefined;
  const planRunners = universeDataset && dependencies.strategyRuns ? [
    createMomentumPlanRunner({ build: universeDataset, account: dependencies.accountBroker, risk: dependencies.riskContextProvider, runs: dependencies.strategyRuns }),
    createSessionPlanRunner({ scheduler: strategyScheduler, build: universeDataset }),
  ] : undefined;
  if (environment.MARKET_DATA_SCHEDULE_ENABLED || environment.PAPER_LOOP_SCHEDULE_ENABLED || environment.NEWS_SCHEDULE_ENABLED
    || environment.UNIVERSE_PLAN_SCHEDULE_ENABLED || environment.NEWS_ANALYSIS_ENABLED) {
    if (environment.UNIVERSE_PLAN_SCHEDULE_ENABLED && !planRunners) throw new Error('Plan schedule dependencies required');
    const momentumExecutor = environment.MOMENTUM_EXECUTION_ENABLED && dependencies.orders && dependencies.consoleRead && controls
      ? createMomentumExecutor({ plans: dependencies.consoleRead, orders: dependencies.orders, isEnabled: controls.isAutoTradingEnabled }) : undefined;
    if (environment.MOMENTUM_EXECUTION_ENABLED && !momentumExecutor) throw new Error('Momentum execution dependencies required');
    const screenNews = environment.NEWS_ANALYSIS_ENABLED && dependencies.newsAssessor && dependencies.newsRepository && dependencies.apiQuota
      && dependencies.assessments && dependencies.consoleRead ? createNewsScreener({ assessor: dependencies.newsAssessor,
        news: dependencies.newsRepository, quota: dependencies.apiQuota, repository: dependencies.assessments, plans: dependencies.consoleRead,
        caps: aiCaps }) : undefined;
    if (environment.NEWS_ANALYSIS_ENABLED && !screenNews) throw new Error('News analysis dependencies required');
    if (environment.NEWS_SCHEDULE_ENABLED && !collectNews) throw new Error('News schedule dependencies required');
    if ((environment.MARKET_DATA_SCHEDULE_ENABLED && !collect) || (environment.PAPER_LOOP_SCHEDULE_ENABLED && (!prepare || !tick || !controls))) {
      throw new Error('Daily schedule dependencies required');
    }
    const report = (event: string, detail?: Record<string, string>) => app.log.info({ event, ...detail }, 'Daily schedule');
    const step = createDailySchedule({ report,
      collect: environment.MARKET_DATA_SCHEDULE_ENABLED ? collect : undefined, symbols: universeSymbols(),
      news: environment.NEWS_SCHEDULE_ENABLED ? collectNews : undefined,
      plans: environment.UNIVERSE_PLAN_SCHEDULE_ENABLED ? planRunners : undefined,
      executeMomentum: environment.MOMENTUM_EXECUTION_ENABLED ? momentumExecutor : undefined,
      screenNews,
      loop: environment.PAPER_LOOP_SCHEDULE_ENABLED && prepare && tick && controls ? { prepare, tick, isEnabled: controls.isAutoTradingEnabled } : undefined });
    let stop: (() => Promise<void>) | undefined;
    app.addHook('onReady', async () => { stop = startDailyScheduleTimer(step, (event) => app.log.error({ event }, 'Daily schedule')); });
    app.addHook('preClose', async () => { await stop?.(); });
  }
  if (environment.MINUTE_BARS_SCHEDULE_ENABLED) {
    if (!dependencies.minuteBars || !dependencies.minuteBarSource) throw new Error('Minute bar schedule dependencies required');
    const step = createMinuteBarSchedule({ collect: createMinuteBarCollector({ source: dependencies.minuteBarSource, repository: dependencies.minuteBars }),
      symbols: universeSymbols(), report: (event, detail) => app.log.info({ event, ...detail }, 'Minute bar schedule') });
    let stop: (() => Promise<void>) | undefined;
    app.addHook('onReady', async () => { stop = startDailyScheduleTimer(step, (event) => app.log.error({ event }, 'Minute bar schedule'), 60000); });
    app.addHook('preClose', async () => { await stop?.(); });
  }
  if (environment.DISCLOSURE_SCHEDULE_ENABLED) {
    if (!dependencies.disclosureSource || !dependencies.disclosures || !dependencies.apiQuota) throw new Error('Disclosure schedule dependencies required');
    // Self-imposed cap far below OpenDART's 20,000 calls/day; one run is about 40 pages.
    const collectDisclosures = createDisclosureCollector({ source: dependencies.disclosureSource, quota: dependencies.apiQuota,
      caps: { daily: 300, monthly: 6000 }, repository: dependencies.disclosures, symbols: universeSymbols() });
    const step = createDisclosureSchedule({ collect: collectDisclosures, report: (event, detail) => app.log.info({ event, ...detail }, 'Disclosure schedule') });
    let stop: (() => Promise<void>) | undefined;
    app.addHook('onReady', async () => { stop = startDailyScheduleTimer(step, (event) => app.log.error({ event }, 'Disclosure schedule'), 60000); });
    app.addHook('preClose', async () => { await stop?.(); });
  }
  if (environment.INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED) {
    if (!dependencies.intradaySignals) throw new Error('Intraday signal repository required');
    const step = createTakeProfitWatch({ account: dependencies.accountBroker, market: dependencies.marketBroker, signals: dependencies.intradaySignals,
      report: (event, detail) => app.log.info({ event, ...detail }, 'Take profit watch') });
    let stop: (() => Promise<void>) | undefined;
    app.addHook('onReady', async () => { stop = startDailyScheduleTimer(step, (event) => app.log.error({ event }, 'Take profit watch'), 60000); });
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
