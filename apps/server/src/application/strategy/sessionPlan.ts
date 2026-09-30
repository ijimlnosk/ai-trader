import { createHash } from 'node:crypto';
import type { UniverseDatasetBuilder } from '../marketData/universeDataset.ts';
import type { MarketDataset } from '../../domain/strategy/marketData.ts';

type Scheduler = (runKey: string, sessionDate: string, data: MarketDataset) => Promise<{ runKey: string }>;
export type SessionPlanRunResult =
  | { status: 'saved'; runKey: string; scanned: number; excluded: number }
  | { status: 'skipped'; reason: string };

/** Order-free: evaluates the whole universe once and persists it as a strategy run (plan-*). */
export function createSessionPlanRunner(deps: { build: UniverseDatasetBuilder; scheduler: Scheduler }) {
  return async (): Promise<SessionPlanRunResult> => {
    const dataset = await deps.build();
    if (dataset.status === 'skipped') return dataset;
    const digest = createHash('sha256').update(JSON.stringify(dataset.data)).digest('hex');
    const record = await deps.scheduler(`plan-${dataset.sessionDate}-${digest.slice(0, 12)}`, dataset.sessionDate, dataset.data);
    return { status: 'saved', runKey: record.runKey, scanned: dataset.data.series.length, excluded: dataset.excluded.length };
  };
}
export type SessionPlanRunner = ReturnType<typeof createSessionPlanRunner>;
