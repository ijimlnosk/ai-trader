import type { IntradaySignalRepository } from '../../application/strategy/takeProfitWatch.ts';
import type { createDatabase } from './index.ts';
import { intradaySignals as table } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createIntradaySignalRepository(db: Database): IntradaySignalRepository {
  return {
    async record(signal) {
      const rows = await db.insert(table).values({ ...signal, quoteAt: new Date(signal.quoteAt), detectedAt: new Date(signal.detectedAt) })
        .onConflictDoNothing().returning({ id: table.id });
      return rows.length > 0;
    },
  };
}
