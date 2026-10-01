import { createHash } from 'node:crypto';
import { explicitSessionCalendar, isSeoulTradingSession } from '../../domain/scheduler/session.ts';
import { DEFAULT_MOMENTUM_CONFIG, evaluateMomentum, isRebalanceSession, wholeShares } from '../../domain/strategy/momentum.ts';
import type { UniverseDatasetBuilder } from '../marketData/universeDataset.ts';
import { riskPortfolioSchema } from '../paperRiskContext.ts';
import type { AccountBroker } from '../portfolio.ts';
import type { RiskContextProvider } from '../risk.ts';
import type { StrategyRunRepository } from '../scheduler/index.ts';
import type { SessionPlanRunResult } from './sessionPlan.ts';

export const MOMENTUM_PLAN_PREFIX = 'plan-momentum-';

/**
 * Order-free momentum-rotation plan for the session, persisted as a strategy run. Account and risk
 * inputs follow the same coherence checks as the EMA strategy service; nothing is submitted.
 */
export function createMomentumPlanRunner(deps: { build: UniverseDatasetBuilder; account: AccountBroker;
  risk: RiskContextProvider; runs: StrategyRunRepository; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (): Promise<SessionPlanRunResult> => {
    const dataset = await deps.build();
    if (dataset.status === 'skipped') return dataset;
    const { data, sessionDate } = dataset;
    const dataSha256 = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const runKey = `${MOMENTUM_PLAN_PREFIX}${sessionDate}-${dataSha256.slice(0, 12)}`;
    const scanned = data.series.length; const excluded = dataset.excluded.length;
    if (await deps.runs.get(runKey)) return { status: 'saved', runKey, scanned, excluded };
    const at = now();
    if (!isSeoulTradingSession(at, explicitSessionCalendar([sessionDate]))) return { status: 'skipped', reason: 'outside_session' };
    const snapshot = await deps.account.getPortfolio();
    const portfolio = riskPortfolioSchema.safeParse(snapshot);
    const context = portfolio.success ? await deps.risk.getRiskContext(snapshot) : null;
    if (!portfolio.success || !context || context.cash !== portfolio.data.cash || context.totalEquity !== portfolio.data.totalEvaluation
      || context.openPositionCount !== portfolio.data.positions.length) return { status: 'skipped', reason: 'account_context_unavailable' };
    const holdings = new Map(portfolio.data.positions.map((position) => [position.symbol, wholeShares(position.quantity)]));
    const signals = evaluateMomentum({ series: data.series, holdings, account: context, source: data.source,
      rebalance: isRebalanceSession(data.sessions.at(-2), data.sessions.at(-1)!) });
    await deps.runs.put({ runKey, sessionDate, createdAt: at.toISOString(), dataSha256, result: { mode: 'paper', dataSha256,
      configuration: DEFAULT_MOMENTUM_CONFIG, evaluations: signals.map((signal) => ({ signal, context, decision: null })), order: null } });
    return { status: 'saved', runKey, scanned, excluded };
  };
}
