import { createAuth } from '../application/auth/index.ts';
import { createAuthRepository } from '../infrastructure/database/authRepository.ts';
import { passwordVerifier } from '../infrastructure/auth/password.ts';
import { createTradingControlRepository } from '../infrastructure/database/tradingControlRepository.ts';
import { createNewsRepository } from '../infrastructure/database/newsRepository.ts';
import { createApiQuotaRepository } from '../infrastructure/database/apiQuotaRepository.ts';
import { createAssessmentRepository } from '../infrastructure/database/assessmentRepository.ts';
import { createPaperLoopRepository } from '../infrastructure/database/paperLoopRepository.ts';
import { createDatabase } from '../infrastructure/database/index.ts';
import { createRuntimeApp } from './createRuntimeApp.ts';
import { parseEnvironment } from './environment.ts';
import { createHash } from 'node:crypto';
import { createOrderRepository } from '../infrastructure/database/orderRepository.ts';
import { createStrategyRunRepository } from '../infrastructure/database/strategyRunRepository.ts';
import { createDailySnapshotRepository } from '../infrastructure/database/dailySnapshotRepository.ts';
import { createConsoleReadRepository } from '../infrastructure/database/consoleReadRepository.ts';
import { createMinuteBarRepository } from '../infrastructure/database/minuteBarRepository.ts';
import { createIntradaySignalRepository } from '../infrastructure/database/intradaySignalRepository.ts';
import { createDisclosureRepository } from '../infrastructure/database/disclosureRepository.ts';
import { createInsightReadRepository } from '../infrastructure/database/insightReadRepository.ts';
import { createShadowTradeRepository } from '../infrastructure/database/shadowTradeRepository.ts';

async function start() {
  const environment = parseEnvironment(process.env);
  if (environment.BROKER_MODE !== 'paper') throw new Error('Live broker is not implemented');
  const database = createDatabase(environment.DATABASE_URL);
  const executionAccount = createHash('sha256').update(`paper:${environment.KIS_ACCOUNT_NO ?? ''}:${environment.KIS_ACCOUNT_PRODUCT_CODE ?? ''}`).digest('hex');
  const app = createRuntimeApp(environment, database, true, undefined, undefined, createOrderRepository(database.db, executionAccount), createStrategyRunRepository(database.db, executionAccount), createPaperLoopRepository(database.db, executionAccount),
    createDailySnapshotRepository(database.db), createConsoleReadRepository(database.db, executionAccount), createAuth(createAuthRepository(database.db), passwordVerifier), executionAccount,
    createTradingControlRepository(database.db), createNewsRepository(database.db), createApiQuotaRepository(database.db),
    createAssessmentRepository(database.db), createMinuteBarRepository(database.db), createIntradaySignalRepository(database.db),
    createDisclosureRepository(database.db), createInsightReadRepository(database.db), createShadowTradeRepository(database.db));
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
