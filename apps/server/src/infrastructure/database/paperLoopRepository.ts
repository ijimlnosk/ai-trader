import { and, eq, or, sql } from 'drizzle-orm';
import { PaperLoopError, type PaperLoopRepository, type PaperLoopRun } from '../../application/paperLoop/ports.ts';
import { assertSameLoopInput } from '../../application/paperLoop/index.ts';
import type { createDatabase } from './index.ts';
import { paperLoopRuns as runs, orders } from './schema.ts';
import { mapStoredOrder } from './orderMapping.ts';

type Database = ReturnType<typeof createDatabase>['db'];
function mapRun(row: typeof runs.$inferSelect): PaperLoopRun {
  return { id: row.id, input: row.input, orderKey: row.orderKey, status: row.status, result: row.result,
    order: row.order, reason: row.reason, deadline: row.deadline.toISOString(), version: row.version,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function createPaperLoopRepository(db: Database, account: string): PaperLoopRepository {
  const scope = eq(runs.executionAccount, account);
  const repo: PaperLoopRepository = {
    async find(runKey, orderKey) {
      const rows = await db.select().from(runs).where(and(scope, or(eq(runs.runKey, runKey), eq(runs.orderKey, orderKey))));
      if (rows.length > 1) throw new PaperLoopError('loop_conflict');
      return rows[0] ? mapRun(rows[0]) : null;
    },
    async claim(input, orderKey, deadline) {
      const [row] = await db.insert(runs).values({ executionAccount: account, runKey: input.runKey,
        orderKey, input, deadline: new Date(deadline) }).onConflictDoNothing().returning();
      if (row) return { run: mapRun(row), created: true };
      const run = await repo.find(input.runKey, orderKey);
      if (!run) throw new PaperLoopError('loop_busy');
      assertSameLoopInput(run.input, input);
      return { run, created: false };
    },
    async update(run, patch) {
      const [row] = await db.update(runs).set({ ...patch, updatedAt: new Date(), version: run.version + 1 })
        .where(and(scope, eq(runs.id, run.id), eq(runs.version, run.version))).returning();
      if (!row) throw new PaperLoopError('loop_conflict');
      return mapRun(row);
    },
    async findOrder(key) {
      const [row] = await db.select().from(orders).where(and(eq(orders.executionAccount, account), eq(orders.idempotencyKey, key)));
      return row ? mapStoredOrder(row) : null;
    },
    async hasUnresolvedOrder() {
      const [row] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.executionAccount, account), sql`
        ${orders.brokerStatus} IN ('PREPARING','SUBMITTING','UNKNOWN','SUBMITTED','PARTIALLY_FILLED') OR
        (${orders.brokerStatus} IN ('FILLED','CANCELLED') AND ${orders.positionsSyncedAt} IS NULL)`)).limit(1);
      return Boolean(row);
    },
  };
  return repo;
}
