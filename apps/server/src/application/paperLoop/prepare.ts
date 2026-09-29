import { seoulOrderDate } from '../../domain/orders.ts';
import { KRX_CALENDAR, krxSessionStatus, previousKrxSession } from '../../domain/scheduler/krxCalendar.ts';
import type { DailySnapshotRepository } from '../marketData/ports.ts';
import { paperLoopInputSchema, type PaperLoopInput } from './input.ts';

export type PrepareResult =
  | { status: 'ready'; input: PaperLoopInput }
  | { status: 'skipped'; reason: 'not_a_session' | 'calendar_unknown' | 'snapshot_missing' };

/**
 * Builds the tick input for today's Seoul session from the archived snapshot of the previous
 * session. It never fetches data itself; admission, freshness and risk stay with the loop.
 */
export function createPaperLoopPreparer(deps: { snapshots: DailySnapshotRepository; now?: () => Date }) {
  return async (): Promise<PrepareResult> => {
    const sessionDate = seoulOrderDate((deps.now ?? (() => new Date()))().toISOString());
    const status = krxSessionStatus(sessionDate);
    if (status !== 'session') return { status: 'skipped', reason: status === 'closed' ? 'not_a_session' : 'calendar_unknown' };
    const previous = previousKrxSession(sessionDate);
    if (!previous) return { status: 'skipped', reason: 'calendar_unknown' };
    const snapshot = await deps.snapshots.latestThrough('005930', previous);
    if (!snapshot) return { status: 'skipped', reason: 'snapshot_missing' };
    return { status: 'ready', input: paperLoopInputSchema.parse({
      runKey: `loop-${sessionDate}-${snapshot.datasetSha256.slice(0, 12)}`,
      sessionDate,
      dataSha256: snapshot.datasetSha256,
      dataRef: `market_daily_snapshots:${snapshot.id}`,
      calendar: { source: `${KRX_CALENDAR.version} (repository-reviewed KRX calendar)`,
        sessions: [...snapshot.dataset.sessions, sessionDate] },
      data: snapshot.dataset,
    }) };
  };
}
export type PaperLoopPreparer = ReturnType<typeof createPaperLoopPreparer>;
