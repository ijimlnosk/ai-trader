import { and, eq, inArray, sql } from 'drizzle-orm';
import type { ApiQuota } from '../../application/news/ports.ts';
import type { createDatabase } from './index.ts';
import { externalApiUsage as usage } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

/** Both day and month rows are locked and checked in one transaction before one call is reserved. */
export function createApiQuotaRepository(db: Database): ApiQuota {
  return {
    async consume(provider, day, month, caps) {
      const periods = [`d:${day}`, `m:${month}`];
      return db.transaction(async (tx) => {
        await tx.insert(usage).values(periods.map((period) => ({ provider, period, used: 0 }))).onConflictDoNothing();
        const rows = await tx.select().from(usage).where(and(eq(usage.provider, provider), inArray(usage.period, periods))).for('update');
        const used = (period: string) => rows.find((row) => row.period === period)?.used ?? Number.POSITIVE_INFINITY;
        if (used(periods[0]!) >= caps.daily || used(periods[1]!) >= caps.monthly) return false;
        await tx.update(usage).set({ used: sql`${usage.used} + 1`, updatedAt: new Date() })
          .where(and(eq(usage.provider, provider), inArray(usage.period, periods)));
        return true;
      });
    },
    async usage(provider, day, month) {
      const rows = await db.select().from(usage).where(and(eq(usage.provider, provider), inArray(usage.period, [`d:${day}`, `m:${month}`])));
      return { daily: rows.find((row) => row.period === `d:${day}`)?.used ?? 0, monthly: rows.find((row) => row.period === `m:${month}`)?.used ?? 0 };
    },
  };
}
