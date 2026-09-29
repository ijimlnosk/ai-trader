import { createDatabase } from '../infrastructure/database/index.ts';
import { manageUser } from '../infrastructure/auth/manageUser.ts';

// Administrative local/SSH command only. JSON arrives on stdin, never through argv or HTTP.
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Database required');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk); size += buffer.length;
    if (size > 4096) throw new Error('Input too large');
    chunks.push(buffer);
  }
  const database = createDatabase(process.env.DATABASE_URL);
  try {
    const result = await manageUser(database.db, JSON.parse(Buffer.concat(chunks).toString('utf8')), process.env);
    process.stdout.write(JSON.stringify({ ok: true, ...result }) + '\n');
  } finally { await database.close(); }
}
main().catch(() => {
  // Driver/schema errors can include supplied password hashes or credentials. Never print them.
  process.stderr.write('Console user update failed. Check input, email/account uniqueness and database configuration.\n');
  process.exitCode = 1;
});
