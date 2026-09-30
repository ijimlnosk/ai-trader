import { and, desc, eq, like } from 'drizzle-orm';
import type { ConsoleReadRepository } from '../../application/console/index.ts';
import type { createDatabase } from './index.ts';
import { mapSnapshot } from './dailySnapshotRepository.ts';
import { mapStoredOrder } from './orderMapping.ts';
import { mapRun } from './paperLoopRepository.ts';
import { marketDailySnapshots, orders, paperLoopRuns, strategyRuns } from './schema.ts';
import type { StrategyRunRecord } from '../../application/scheduler/index.ts';

type Database = ReturnType<typeof createDatabase>['db'];

/** Read-only, newest-first. Orders and loop runs are limited to the configured execution account. */
export function createConsoleReadRepository(db: Database, executionAccount: string): ConsoleReadRepository {
  return {
    async listOrders(limit) {
      const rows = await db.select().from(orders).where(eq(orders.executionAccount, executionAccount))
        .orderBy(desc(orders.createdAt)).limit(limit);
      return rows.map(mapStoredOrder);
    },
    async listLoopRuns(limit) {
      const rows = await db.select().from(paperLoopRuns).where(eq(paperLoopRuns.executionAccount, executionAccount))
        .orderBy(desc(paperLoopRuns.createdAt)).limit(limit);
      return rows.map(mapRun);
    },
    async latestPlanRun(prefix) {
      const [row] = await db.select().from(strategyRuns)
        .where(and(eq(strategyRuns.executionAccount, executionAccount), like(strategyRuns.runKey, `${prefix.replaceAll('%', '').replaceAll('_', '\\_')}%`)))
        .orderBy(desc(strategyRuns.createdAt)).limit(1);
      return row ? { runKey: row.runKey, sessionDate: row.sessionDate, createdAt: row.createdAt.toISOString(),
        dataSha256: row.dataSha256, result: row.result as StrategyRunRecord['result'] } : null;
    },
    async listSnapshots(limit) {
      const rows = await db.select().from(marketDailySnapshots)
        .orderBy(desc(marketDailySnapshots.createdAt)).limit(limit);
      return rows.map(mapSnapshot);
    },
  };
}
