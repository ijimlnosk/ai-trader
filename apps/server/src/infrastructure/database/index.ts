import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

export function createDatabase(databaseUrl: string) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 5,
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
    statement_timeout: 3000,
    idleTimeoutMillis: 30000,
  });
  // Idle socket failures are reported without driver errors that can contain secrets.
  pool.on('error', () => {
    process.stderr.write(JSON.stringify({ level: 'error', event: 'database_idle_connection_error' }) + '\n');
  });
  return {
    db: drizzle(pool, { schema }),
    async checkConnection(): Promise<void> { await pool.query('SELECT 1'); },
    async close(): Promise<void> { await pool.end(); },
  };
}
