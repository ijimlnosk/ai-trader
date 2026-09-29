import { createHash } from 'node:crypto';
import { seoulOrderDate } from '../../domain/orders.ts';
import { KRX_CALENDAR, krxSessionStatus, krxSessionsBetween, previousKrxSession } from '../../domain/scheduler/krxCalendar.ts';
import type { DailyCandle } from '../../domain/strategy/marketData.ts';
import { datasetSchema } from '../strategy/input.ts';
import type { DailyHistorySource, DailySnapshot, DailySnapshotRepository } from './ports.ts';

/** 18:30 KST: after the after-hours single-price session, whose volume KIS adds to the daily bar. */
const COLLECTABLE_MINUTE_SEOUL = 18 * 60 + 30;

export type CollectResult =
  | { status: 'saved' | 'unchanged'; snapshot: DailySnapshot }
  | { status: 'skipped'; reason: 'calendar_unknown' | 'bar_missing' | 'calendar_mismatch' };

const sha256 = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Latest session whose daily bar is final at `now`, or null when the calendar cannot say. */
export function completedSessionAt(now: Date): string | null {
  const today = seoulOrderDate(now.toISOString());
  const seoul = new Date(now.getTime() + 9 * 3600000);
  const final = seoul.getUTCHours() * 60 + seoul.getUTCMinutes() >= COLLECTABLE_MINUTE_SEOUL;
  if (final && krxSessionStatus(today) === 'session') return today;
  return previousKrxSession(today);
}

function revisedDates(previous: DailySnapshot | null, candles: readonly DailyCandle[]): string[] {
  const old = new Map(previous?.dataset.series[0]?.candles.map((bar) => [bar.date, JSON.stringify(bar)]));
  return candles.filter((bar) => old.has(bar.date) && old.get(bar.date) !== JSON.stringify(bar)).map((bar) => bar.date);
}

export function createDailySnapshotCollector(deps: {
  history: DailyHistorySource; snapshots: DailySnapshotRepository; now?: () => Date;
}) {
  return async (symbol: string): Promise<CollectResult> => {
    const through = completedSessionAt((deps.now ?? (() => new Date()))());
    if (!through) return { status: 'skipped', reason: 'calendar_unknown' };
    const history = await deps.history.getDailyHistory(symbol, KRX_CALENDAR.from, through);
    const { candles } = history;
    if (candles.at(-1)?.date !== through) return { status: 'skipped', reason: 'bar_missing' };
    const expected = krxSessionsBetween(candles[0]!.date, through);
    if (!expected || expected.length !== candles.length || candles.some((bar, i) => bar.date !== expected[i])) {
      return { status: 'skipped', reason: 'calendar_mismatch' };
    }
    const dataset = datasetSchema.parse({ source: history.source, timezone: 'Asia/Seoul', priceBasis: 'raw',
      sessions: expected, series: [{ symbol, candles }] });
    const previous = await deps.snapshots.latest(symbol);
    const { snapshot, created } = await deps.snapshots.save({ symbol, through, collectedAt: history.retrievedAt,
      calendarVersion: KRX_CALENDAR.version, rawSha256: history.rawSha256, dataset, datasetSha256: sha256(dataset),
      candlesSha256: sha256({ sessions: dataset.sessions, candles }), revisedDates: revisedDates(previous, candles) });
    return { status: created ? 'saved' : 'unchanged', snapshot };
  };
}
export type DailySnapshotCollector = ReturnType<typeof createDailySnapshotCollector>;
