import { seoulOrderDate } from '../../domain/orders.ts';
import { krxSessionStatus, previousKrxSession } from '../../domain/scheduler/krxCalendar.ts';
import { hasPriceDiscontinuity, type MarketDataset } from '../../domain/strategy/marketData.ts';
import { confirmationStart } from '../paperLoop/prepare.ts';
import { datasetSchema } from '../strategy/input.ts';
import type { DailySnapshotRepository } from './ports.ts';

export type UniverseDatasetResult =
  | { status: 'ready'; sessionDate: string; data: MarketDataset; excluded: { symbol: string; reason: string }[] }
  | { status: 'skipped'; reason: 'not_a_session' | 'calendar_unknown' | 'no_confirmed_data' };

/**
 * Combines each symbol's snapshot through the previous session into one aligned dataset. Only
 * snapshots re-confirmed on the session morning are used; symbols whose sessions differ from the
 * first confirmed symbol are excluded (never padded or trimmed) and reported.
 */
export function createUniverseDatasetBuilder(deps: { snapshots: DailySnapshotRepository; symbols: readonly string[];
  label: string; now?: () => Date }) {
  return async (): Promise<UniverseDatasetResult> => {
    const sessionDate = seoulOrderDate((deps.now ?? (() => new Date()))().toISOString());
    const status = krxSessionStatus(sessionDate);
    if (status !== 'session') return { status: 'skipped', reason: status === 'closed' ? 'not_a_session' : 'calendar_unknown' };
    const previous = previousKrxSession(sessionDate);
    if (!previous) return { status: 'skipped', reason: 'calendar_unknown' };
    const excluded: { symbol: string; reason: string }[] = [];
    const series: MarketDataset['series'] = [];
    let sessions: string[] | null = null;
    for (const symbol of deps.symbols) {
      const snapshot = await deps.snapshots.latestThrough(symbol, previous);
      if (!snapshot) { excluded.push({ symbol, reason: 'snapshot_missing' }); continue; }
      if (Date.parse(snapshot.confirmedAt) < confirmationStart(sessionDate)) { excluded.push({ symbol, reason: 'snapshot_unconfirmed' }); continue; }
      const own = snapshot.dataset.series[0];
      sessions ??= [...snapshot.dataset.sessions];
      if (!own || own.symbol !== symbol || snapshot.dataset.sessions.join() !== sessions.join()) { excluded.push({ symbol, reason: 'sessions_mismatch' }); continue; }
      if (hasPriceDiscontinuity(own.candles)) { excluded.push({ symbol, reason: 'price_discontinuity' }); continue; }
      series.push({ symbol, candles: own.candles });
    }
    if (!sessions || series.length === 0) return { status: 'skipped', reason: 'no_confirmed_data' };
    const data = datasetSchema.parse({ source: `KIS daily snapshots ${deps.label} through ${previous}`, timezone: 'Asia/Seoul',
      priceBasis: 'raw', sessions, series });
    return { status: 'ready', sessionDate, data, excluded };
  };
}
export type UniverseDatasetBuilder = ReturnType<typeof createUniverseDatasetBuilder>;
