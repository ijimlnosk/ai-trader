import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DailySnapshot, DailySnapshotRepository } from '../../application/marketData/ports.ts';
import { datasetSchema } from '../../application/strategy/input.ts';
import type { createDatabase } from './index.ts';
import { marketDailySnapshots as snapshots } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

/**
 * jsonb does not preserve key order, so the dataset is re-parsed into schema order and its digest
 * rechecked. A stored dataset that no longer matches its digest is never returned as usable data.
 */
export function mapSnapshot(row: typeof snapshots.$inferSelect): DailySnapshot {
  const dataset = datasetSchema.parse(row.dataset);
  if (createHash('sha256').update(JSON.stringify(dataset)).digest('hex') !== row.datasetSha256) {
    throw new Error('Stored market snapshot digest mismatch');
  }
  return { id: row.id, symbol: row.symbol, through: row.through, collectedAt: row.collectedAt.toISOString(),
    calendarVersion: row.calendarVersion, rawSha256: row.rawSha256, dataset, datasetSha256: row.datasetSha256,
    candlesSha256: row.candlesSha256, revisedDates: row.revisedDates,
    confirmedAt: (row.confirmedAt && row.confirmedAt > row.collectedAt ? row.confirmedAt : row.collectedAt).toISOString() };
}

export function createDailySnapshotRepository(db: Database): DailySnapshotRepository {
  const newest = async (...conditions: ReturnType<typeof eq>[]) => {
    const [row] = await db.select().from(snapshots).where(and(...conditions))
      .orderBy(desc(sql`GREATEST(${snapshots.confirmedAt}, ${snapshots.collectedAt})`), desc(snapshots.createdAt)).limit(1);
    return row ? mapSnapshot(row) : null;
  };
  return {
    latest: (symbol) => newest(eq(snapshots.symbol, symbol)),
    latestThrough: (symbol, through) => newest(eq(snapshots.symbol, symbol), eq(snapshots.through, through)),
    async save(snapshot) {
      const [row] = await db.insert(snapshots).values({ ...snapshot, collectedAt: new Date(snapshot.collectedAt) })
        .onConflictDoNothing().returning();
      if (row) return { snapshot: mapSnapshot(row), created: true };
      // Identical candles re-observed: record the confirmation time, never the retrieval payload.
      const [existing] = await db.update(snapshots).set({ confirmedAt: sql`GREATEST(${snapshots.confirmedAt}, ${new Date(snapshot.collectedAt)})` })
        .where(and(eq(snapshots.symbol, snapshot.symbol), eq(snapshots.through, snapshot.through),
          eq(snapshots.candlesSha256, snapshot.candlesSha256))).returning();
      if (!existing) throw new Error('Market snapshot persistence conflict');
      return { snapshot: mapSnapshot(existing), created: false };
    },
  };
}
