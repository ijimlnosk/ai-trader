import { and, desc, eq, gt, lte } from 'drizzle-orm';
import type { OwnerSettingsRepository, StoredSettings } from '../../application/settings/index.ts';
import type { createDatabase } from './index.ts';
import { consoleUsers, ownerSettings as table } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createOwnerSettingsRepository(db: Database): OwnerSettingsRepository {
  const select = () => db.select({ settings: table.settings, effectiveFrom: table.effectiveFrom, createdAt: table.createdAt, email: consoleUsers.email })
    .from(table).leftJoin(consoleUsers, eq(table.createdBy, consoleUsers.id));
  const map = (row: { settings: unknown; effectiveFrom: string; createdAt: Date; email: string | null }): StoredSettings =>
    ({ settings: row.settings, effectiveFrom: row.effectiveFrom, createdAt: row.createdAt.toISOString(), byEmail: row.email });
  return {
    async effectiveOn(account, date) {
      const [row] = await select().where(and(eq(table.executionAccount, account), lte(table.effectiveFrom, date)))
        .orderBy(desc(table.effectiveFrom), desc(table.createdAt)).limit(1);
      return row ? map(row) : null;
    },
    async pendingAfter(account, date) {
      const [row] = await select().where(and(eq(table.executionAccount, account), gt(table.effectiveFrom, date))).orderBy(desc(table.createdAt)).limit(1);
      return row ? map(row) : null;
    },
    async history(account, limit) {
      return (await select().where(eq(table.executionAccount, account)).orderBy(desc(table.createdAt)).limit(limit)).map(map);
    },
    async insert(account, settings, effectiveFrom, userId) {
      await db.insert(table).values({ executionAccount: account, settings, effectiveFrom, createdBy: userId });
    },
  };
}
