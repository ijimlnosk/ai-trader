import type { ConsoleLoopRun, ConsolePlan, ConsolePlanResponse, ConsoleSnapshot, ConsoleStatusResponse, OrderResponse } from '@ai-trader/contracts';
import { planSession } from '../../domain/strategy/plan.ts';
import { UNIVERSE, universeName } from '../../domain/market/universe.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import { KRX_CALENDAR } from '../../domain/scheduler/krxCalendar.ts';
import type { StoredOrder } from '../../domain/orders.ts';
import type { DailySnapshot } from '../marketData/ports.ts';
import { orderResponse } from '../orders/index.ts';
import type { PaperLoopRun } from '../paperLoop/ports.ts';

export const CONSOLE_MAX_LIMIT = 100;
/** Primary strategy first. EMA plans use `plan-<date>`, momentum plans `plan-momentum-<date>`. */
const PLAN_STRATEGIES = [['momentum-rotation', '모멘텀 교체', 'plan-momentum-'], ['ema-cross', 'EMA 교차 (기존)', 'plan-2']] as const;

/** Newest-first, bounded reads for the operator console; account scope belongs to the adapter. */
export interface ConsoleReadRepository {
  listOrders(limit: number): Promise<StoredOrder[]>;
  listLoopRuns(limit: number): Promise<PaperLoopRun[]>;
  listSnapshots(limit: number): Promise<DailySnapshot[]>;
  /** Most recent order-free plan run whose key starts with the given prefix. */
  latestPlanRun(prefix: string): Promise<StrategyRunRecord | null>;
}

export type ConsoleFlags = Omit<ConsoleStatusResponse, 'checkedAt' | 'calendar'>;

function loopRun(run: PaperLoopRun): ConsoleLoopRun {
  const evaluation = run.result?.evaluations.find((item) => item.signal.symbol === '005930');
  const proposal = evaluation?.signal.proposal;
  return { id: run.id, runKey: run.input.runKey, sessionDate: run.input.sessionDate, status: run.status,
    reason: run.reason, dataSha256: run.input.dataSha256, dataRef: run.input.dataRef,
    signal: evaluation ? { reason: evaluation.signal.reason, side: proposal?.side ?? null, quantity: proposal?.quantity ?? null } : null,
    decision: evaluation?.decision ? { approved: evaluation.decision.approved, reasons: [...evaluation.decision.reasons] } : null,
    order: run.order, createdAt: run.createdAt, updatedAt: run.updatedAt };
}

function snapshot(item: DailySnapshot): ConsoleSnapshot {
  return { id: item.id, symbol: item.symbol, through: item.through, collectedAt: item.collectedAt,
    calendarVersion: item.calendarVersion, bars: item.dataset.sessions.length, datasetSha256: item.datasetSha256,
    candlesSha256: item.candlesSha256, revisedDates: item.revisedDates, confirmedAt: item.confirmedAt, lastBar: item.dataset.series[0]?.candles.at(-1) ?? null };
}

export function createConsoleQueries(deps: { repository: ConsoleReadRepository; flags: ConsoleFlags; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return {
    status: (): ConsoleStatusResponse => ({ checkedAt: now().toISOString(), ...deps.flags,
      calendar: { version: KRX_CALENDAR.version, from: KRX_CALENDAR.from, through: KRX_CALENDAR.through } }),
    orders: async (limit: number): Promise<OrderResponse[]> => (await deps.repository.listOrders(limit)).map(orderResponse),
    loopRuns: async (limit: number) => (await deps.repository.listLoopRuns(limit)).map(loopRun),
    snapshots: async (limit: number) => (await deps.repository.listSnapshots(limit)).map(snapshot),
    plan: async (): Promise<ConsolePlanResponse> => {
      const plans: ConsolePlan[] = [];
      for (const [strategyId, label, prefix] of PLAN_STRATEGIES) {
        const run = await deps.repository.latestPlanRun(prefix);
        const evaluations = run?.result.evaluations ?? [];
        if (!run || evaluations.length === 0) continue;
        const plan = planSession(evaluations.map((evaluation) => evaluation.signal), evaluations[0]!.context);
        plans.push({ strategyId, label, runKey: run.runKey, sessionDate: run.sessionDate, createdAt: run.createdAt, scanned: plan.scanned,
        universeSize: UNIVERSE.symbols.length, reasons: plan.reasons, items: plan.items.map((item) => ({ rank: item.rank,
          symbol: item.symbol, name: universeName(item.symbol) ?? item.symbol, side: item.side, quantity: item.quantity,
          estimatedPrice: item.estimatedPrice, reason: item.reason, approved: item.decision.approved, rejections: [...item.decision.reasons] })) });
      }
      return { plans };
    },
  };
}
export type ConsoleQueries = ReturnType<typeof createConsoleQueries>;
