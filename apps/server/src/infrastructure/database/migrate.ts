import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './index.ts';

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const database = createDatabase(url);
  try {
    await migrate(database.db, { migrationsFolder: fileURLToPath(new URL('../../../drizzle/', import.meta.url)) });
    process.stdout.write('Migrations applied successfully\n');
  } finally { await database.close(); }
}

run().catch(() => {
  process.stderr.write('Migration failed; check database configuration and migration state\n');
  process.exitCode = 1;
});
