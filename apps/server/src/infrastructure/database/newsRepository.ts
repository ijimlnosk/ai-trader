import { desc } from 'drizzle-orm';
import type { NewsRepository } from '../../application/news/ports.ts';
import type { createDatabase } from './index.ts';
import { newsItems } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];

export function createNewsRepository(db: Database): NewsRepository {
  return {
    async save(items) {
      if (items.length === 0) return 0;
      const rows = await db.insert(newsItems).values(items.map((item) => ({ ...item, publishedAt: new Date(item.publishedAt),
        collectedAt: new Date(item.collectedAt) }))).onConflictDoNothing().returning({ id: newsItems.id });
      return rows.length;
    },
    async recent(limit) {
      const rows = await db.select().from(newsItems).orderBy(desc(newsItems.publishedAt)).limit(limit);
      return rows.map((row) => ({ ...row, publishedAt: row.publishedAt.toISOString(), collectedAt: row.collectedAt.toISOString() }));
    },
  };
}
