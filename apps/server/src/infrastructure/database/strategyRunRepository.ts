import { and, eq } from 'drizzle-orm';
import type { StrategyRunRecord, StrategyRunRepository } from '../../application/scheduler/index.ts';
import type { createDatabase } from './index.ts';
import { strategyRuns } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createStrategyRunRepository(db: Database, executionAccount: string): StrategyRunRepository {
  const scope = eq(strategyRuns.executionAccount, executionAccount);
  return {
    async get(runKey) {
      const [row] = await db.select().from(strategyRuns).where(and(scope, eq(strategyRuns.runKey, runKey)));
      if (!row) return null;
      return { runKey: row.runKey, sessionDate: row.sessionDate, createdAt: row.createdAt.toISOString(),
        dataSha256: row.dataSha256, result: row.result as StrategyRunRecord['result'] };
    },
    async put(record) {
      await db.insert(strategyRuns).values({ runKey: record.runKey, executionAccount,
        sessionDate: record.sessionDate, dataSha256: record.dataSha256, result: record.result,
        createdAt: new Date(record.createdAt) }).onConflictDoNothing();
      const saved = await this.get(record.runKey);
      if (!saved || saved.dataSha256 !== record.dataSha256) throw new Error('Strategy run persistence conflict');
    },
  };
}
