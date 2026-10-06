import type { DisclosureRepository } from '../../application/disclosures/ports.ts';
import type { createDatabase } from './index.ts';
import { dartDisclosures as table } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createDisclosureRepository(db: Database): DisclosureRepository {
  return {
    async save(items) {
      if (items.length === 0) return 0;
      const rows = await db.insert(table).values(items.map((item) => ({ ...item, collectedAt: new Date(item.collectedAt) })))
        .onConflictDoNothing().returning({ receiptNo: table.receiptNo });
      return rows.length;
    },
  };
}
