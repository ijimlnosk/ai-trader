import type { StoredOrder } from '../../domain/orders.ts';
import { seoulOrderDate } from '../../domain/orders.ts';
import { DEFAULT_MOMENTUM_CONFIG, type MomentumEvaluation } from '../../domain/strategy/momentum.ts';
import { planSession } from '../../domain/strategy/plan.ts';
import type { OrderServices } from '../orders/index.ts';
import { OrderError } from '../orders/ports.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import { strategyOrderKey } from './index.ts';
import { MOMENTUM_PLAN_PREFIX } from './momentumPlan.ts';

export type MomentumExecutionResult =
  | { status: 'done'; submitted: number; filled: number; failed: number }
  | { status: 'pending'; symbol: string }
  | { status: 'paused' | 'no_plan' }
  | { status: 'halted'; symbol: string; reason: string };

const TERMINAL_UNFILLED = ['FAILED', 'RISK_REJECTED', 'BROKER_REJECTED'];
const settled = (order: StoredOrder) => ['FILLED', 'CANCELLED'].includes(order.brokerStatus) && Boolean(order.positionsSyncedAt);

/**
 * Executes today's approved momentum plan items one at a time (SELLs first, then ranked BUYs).
 * Stateless and restart-safe: each item has a deterministic order key, so a repeated call replays
 * the stored order instead of sending another. Each call performs at most one reconciliation of a
 * pending order and returns `pending`; ambiguous broker states halt the session for review.
 * Every order still passes the execution-time quote, session, holdings, buying-power and risk checks.
 */
export function createMomentumExecutor(deps: { plans: { latestPlanRun(prefix: string): Promise<StrategyRunRecord | null> };
  orders: OrderServices; isEnabled: () => Promise<boolean>; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (): Promise<MomentumExecutionResult> => {
    const run = await deps.plans.latestPlanRun(MOMENTUM_PLAN_PREFIX);
    if (!run || run.sessionDate !== seoulOrderDate(now().toISOString()) || run.result.evaluations.length === 0) return { status: 'no_plan' };
    const evaluations = run.result.evaluations as unknown as { signal: MomentumEvaluation; context: StrategyRunRecord['result']['evaluations'][number]['context'] }[];
    const plan = planSession(evaluations.map((evaluation) => evaluation.signal), evaluations[0]!.context);
    let submitted = 0; let filled = 0; let failed = 0;
    for (const item of plan.items.filter((planned) => planned.decision.approved)) {
      const signal = evaluations.find((evaluation) => evaluation.signal.symbol === item.symbol)!.signal;
      const key = strategyOrderKey(signal);
      // Pausing stops new submissions; an already-sent order is still reconciled below via replay.
      if (!await deps.isEnabled().catch(() => false)) return { status: 'paused' };
      let order: StoredOrder;
      try {
        order = await deps.orders.submit(key, { symbol: item.symbol, side: item.side, quantity: item.decision.approvedQuantity,
          orderType: 'MARKET', confidence: '1', strategy: { strategyId: signal.strategyId, version: signal.version,
            configId: JSON.stringify(DEFAULT_MOMENTUM_CONFIG), source: signal.source, dataSha256: run.dataSha256, planRunKey: run.runKey,
            evaluatedAt: signal.evaluatedAt, reason: signal.reason as 'MOMENTUM_ENTRY' | 'TREND_EXIT' | 'RANK_EXIT' | 'TRIM',
            account: { cash: item.context.cash, totalEquity: item.context.totalEquity, heldQuantity: signal.heldQuantity }, metrics: signal.metrics! } });
      } catch (error) {
        return { status: 'halted', symbol: item.symbol, reason: error instanceof OrderError ? error.code : 'submission_failed' };
      }
      submitted += 1;
      if (TERMINAL_UNFILLED.includes(order.brokerStatus)) { failed += 1; continue; }
      if (!settled(order)) {
        if (['PREPARING', 'SUBMITTING', 'UNKNOWN'].includes(order.brokerStatus)) return { status: 'halted', symbol: item.symbol, reason: order.brokerStatus };
        try { order = await deps.orders.reconcile(order.id); } catch { return { status: 'pending', symbol: item.symbol }; }
        if (!settled(order)) return { status: 'pending', symbol: item.symbol };
      }
      if (order.brokerStatus === 'FILLED') filled += 1;
    }
    return { status: 'done', submitted, filled, failed };
  };
}
export type MomentumExecutor = ReturnType<typeof createMomentumExecutor>;
