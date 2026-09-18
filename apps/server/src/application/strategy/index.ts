import { createHash } from 'node:crypto';
import { seoulOrderDate } from '../../domain/orders.ts';
import { DEFAULT_STRATEGY_CONFIG } from '../../domain/strategy/config.ts';
import { evaluateStrategy, type StrategyEvaluation } from '../../domain/strategy/evaluate.ts';
import { candleTime, validateDataset, type MarketDataset } from '../../domain/strategy/marketData.ts';
import { DEFAULT_RISK_POLICY, evaluateRisk } from '../../domain/risk/index.ts';
import { orderResponse, type OrderServices } from '../orders/index.ts';
import type { RiskContextProvider } from '../risk.ts';
import type { AccountBroker } from '../portfolio.ts';
import { riskPortfolioSchema } from '../paperRiskContext.ts';
import { OrderError } from '../orders/ports.ts';

/** Same strategy/symbol/bar cannot acquire a second key by changing configuration or side. */
export function strategyOrderKey(signal: StrategyEvaluation): string {
  const hex = createHash('sha256').update(JSON.stringify([signal.strategyId, signal.version, signal.symbol, signal.evaluatedAt])).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function createStrategyService(deps: {
  account: AccountBroker; risk: RiskContextProvider; orders?: OrderServices | undefined; now?: () => Date;
}) {
  return async (data: MarketDataset, executeSymbol?: string) => {
    validateDataset(data);
    const now = (deps.now ?? (() => new Date()))();
    const completedAt = Date.parse(candleTime(data.sessions.at(-1)!, 'close'));
    const age = now.getTime() - completedAt;
    // Conservative daily freshness ceiling; extended holidays require a later valid dataset.
    if (!Number.isFinite(age) || age < 0 || age > 4 * 86400000) throw new OrderError('order_context_unavailable');
    if (executeSymbol !== undefined) {
      const nextWeekday = new Date(completedAt);
      do { nextWeekday.setUTCDate(nextWeekday.getUTCDate() + 1); }
      while ([0, 6].includes(nextWeekday.getUTCDay()));
      if (seoulOrderDate(now.toISOString()) !== nextWeekday.toISOString().slice(0, 10).replaceAll('-', '')) {
        throw new OrderError('order_context_unavailable');
      }
    }
    if (executeSymbol !== undefined && !deps.orders) throw new OrderError('execution_disabled');
    if (executeSymbol !== undefined && !data.series.some((s) => s.symbol === executeSymbol)) throw new OrderError('order_context_unavailable');
    const portfolioResult = riskPortfolioSchema.safeParse(await deps.account.getPortfolio());
    if (!portfolioResult.success) throw new OrderError('order_context_unavailable');
    const portfolio = portfolioResult.data;
    const context = await deps.risk.getRiskContext();
    if (!context || context.cash !== portfolio.cash || context.totalEquity !== portfolio.totalEvaluation
      || context.openPositionCount !== portfolio.positions.length) throw new OrderError('order_context_unavailable');
    const dataSha256 = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const evaluations = [...data.series].sort((a, b) => a.symbol < b.symbol ? -1 : 1).map((series) => {
      const signal = evaluateStrategy(series.symbol, series.candles, { ...context,
        heldQuantity: portfolio.positions.find((p) => p.symbol === series.symbol)?.quantity ?? '0' }, data.source);
      return { signal, context: { ...context }, policy: DEFAULT_RISK_POLICY,
        decision: signal.proposal ? evaluateRisk(signal.proposal, context) : null, orderKey: strategyOrderKey(signal) };
    });
    const selected = evaluations.find((e) => e.signal.symbol === executeSymbol);
    let order = null;
    if (selected?.decision?.approved && selected.signal.proposal && selected.signal.indicators) {
      const { signal } = selected; const proposal = signal.proposal!;
      order = orderResponse(await deps.orders!.submit(selected.orderKey, { symbol: proposal.symbol, side: proposal.side,
        quantity: proposal.quantity, confidence: proposal.confidence, orderType: 'MARKET', strategy: {
          strategyId: signal.strategyId, version: signal.version, configId: signal.configId, source: signal.source,
          dataSha256, evaluatedAt: signal.evaluatedAt, reason: signal.reason, indicators: signal.indicators!,
          candles: data.series.find((series) => series.symbol === signal.symbol)!.candles,
          account: { cash: context.cash, totalEquity: context.totalEquity,
            heldQuantity: portfolio.positions.find((p) => p.symbol === signal.symbol)?.quantity ?? '0' },
        } }));
    }
    return { mode: 'paper' as const, dataSha256, configuration: DEFAULT_STRATEGY_CONFIG, evaluations, order };
  };
}
export type StrategyService = ReturnType<typeof createStrategyService>;
