import { desc, eq } from 'drizzle-orm';
import type { TradingControlRepository } from '../../application/controls/index.ts';
import type { createDatabase } from './index.ts';
import { consoleUsers, tradingControlEvents as events, tradingControls as controls } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createTradingControlRepository(db: Database): TradingControlRepository {
  const get: TradingControlRepository['get'] = async (account) => {
    const [row] = await db.select({ enabled: controls.autoTradingEnabled, updatedAt: controls.updatedAt, email: consoleUsers.email })
      .from(controls).leftJoin(consoleUsers, eq(controls.updatedBy, consoleUsers.id)).where(eq(controls.executionAccount, account));
    return row ? { enabled: row.enabled, updatedAt: row.updatedAt.toISOString(), updatedByEmail: row.email }
      : { enabled: false, updatedAt: null, updatedByEmail: null };
  };
  return {
    get,
    async set(account, enabled, userId) {
      await db.transaction(async (tx) => {
        const now = new Date();
        await tx.insert(controls).values({ executionAccount: account, autoTradingEnabled: enabled, updatedBy: userId, updatedAt: now })
          .onConflictDoUpdate({ target: controls.executionAccount, set: { autoTradingEnabled: enabled, updatedBy: userId, updatedAt: now } });
        await tx.insert(events).values({ executionAccount: account, userId, autoTradingEnabled: enabled, createdAt: now });
      });
      return get(account);
    },
    async events(account, limit) {
      const rows = await db.select({ enabled: events.autoTradingEnabled, at: events.createdAt, email: consoleUsers.email })
        .from(events).leftJoin(consoleUsers, eq(events.userId, consoleUsers.id))
        .where(eq(events.executionAccount, account)).orderBy(desc(events.createdAt)).limit(limit);
      return rows.map((row) => ({ enabled: row.enabled, at: row.at.toISOString(), byEmail: row.email }));
    },
  };
}
