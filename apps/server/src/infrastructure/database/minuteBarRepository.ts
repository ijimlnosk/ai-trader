import { and, eq } from 'drizzle-orm';
import type { MinuteBarRepository } from '../../application/marketData/minuteBars.ts';
import type { createDatabase } from './index.ts';
import { marketMinuteBars as table } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createMinuteBarRepository(db: Database): MinuteBarRepository {
  return {
    async exists(symbol, sessionDate) {
      const rows = await db.select({ symbol: table.symbol }).from(table)
        .where(and(eq(table.symbol, symbol), eq(table.sessionDate, sessionDate))).limit(1);
      return rows.length > 0;
    },
    async save(record) {
      await db.insert(table).values({ ...record, barCount: record.bars.length, retrievedAt: new Date(record.retrievedAt) }).onConflictDoNothing();
    },
  };
}
