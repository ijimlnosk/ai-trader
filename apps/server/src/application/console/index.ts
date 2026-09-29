import type { ConsoleLoopRun, ConsoleSnapshot, ConsoleStatusResponse, OrderResponse } from '@ai-trader/contracts';
import { KRX_CALENDAR } from '../../domain/scheduler/krxCalendar.ts';
import type { StoredOrder } from '../../domain/orders.ts';
import type { DailySnapshot } from '../marketData/ports.ts';
import { orderResponse } from '../orders/index.ts';
import type { PaperLoopRun } from '../paperLoop/ports.ts';

export const CONSOLE_MAX_LIMIT = 100;

/** Newest-first, bounded reads for the operator console; account scope belongs to the adapter. */
export interface ConsoleReadRepository {
  listOrders(limit: number): Promise<StoredOrder[]>;
  listLoopRuns(limit: number): Promise<PaperLoopRun[]>;
  listSnapshots(limit: number): Promise<DailySnapshot[]>;
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
    candlesSha256: item.candlesSha256, revisedDates: item.revisedDates, lastBar: item.dataset.series[0]?.candles.at(-1) ?? null };
}

export function createConsoleQueries(deps: { repository: ConsoleReadRepository; flags: ConsoleFlags; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return {
    status: (): ConsoleStatusResponse => ({ checkedAt: now().toISOString(), ...deps.flags,
      calendar: { version: KRX_CALENDAR.version, from: KRX_CALENDAR.from, through: KRX_CALENDAR.through } }),
    orders: async (limit: number): Promise<OrderResponse[]> => (await deps.repository.listOrders(limit)).map(orderResponse),
    loopRuns: async (limit: number) => (await deps.repository.listLoopRuns(limit)).map(loopRun),
    snapshots: async (limit: number) => (await deps.repository.listSnapshots(limit)).map(snapshot),
  };
}
export type ConsoleQueries = ReturnType<typeof createConsoleQueries>;
