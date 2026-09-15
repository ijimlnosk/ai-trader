import { createDatabase } from '../infrastructure/database/index.ts';
import { createApp } from './createApp.ts';
import { parseEnvironment } from './environment.ts';

async function start() {
  const environment = parseEnvironment(process.env);
  if (environment.BROKER_MODE !== 'paper') throw new Error('Live broker is not implemented');
  const database = createDatabase(environment.DATABASE_URL);
  const app = createApp(environment, database);
  app.addHook('onClose', () => database.close());
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    try { await app.close(); }
    catch { app.log.error({ event: 'shutdown_failed' }, 'Shutdown failed'); process.exitCode = 1; }
    finally { clearTimeout(deadline); }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await database.checkConnection();
    await app.listen({ host: environment.HOST, port: environment.PORT });
  } catch {
    app.log.error({ event: 'startup_failed' }, 'Startup failed; verify database connectivity and listen configuration');
    await shutdown();
    process.exitCode = 1;
  }
}

start().catch(() => {
  process.stderr.write(JSON.stringify({ level: 'error', event: 'configuration_failed', msg: 'Check environment configuration; live broker is unsupported' }) + '\n');
  process.exitCode = 1;
});
