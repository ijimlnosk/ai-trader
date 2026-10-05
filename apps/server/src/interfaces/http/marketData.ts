import type { FastifyInstance } from 'fastify';
import type { DailySnapshotCollector } from '../../application/marketData/collect.ts';
import type { PaperLoopPreparer } from '../../application/paperLoop/prepare.ts';
import { BrokerError } from '../../application/brokerError.ts';
import { hasBearerToken } from './serviceToken.ts';

/** Order-free operator endpoints: archive completed daily bars and preview the next loop input. */
export function registerMarketDataRoutes(app: FastifyInstance, deps: {
  collect?: DailySnapshotCollector | undefined; prepare?: PaperLoopPreparer | undefined; apiToken?: string | undefined;
}) {
  app.post('/api/v1/market/daily-snapshots/collect', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!deps.apiToken || !deps.collect) return reply.code(503).send({ error: { code: 'market_data_disabled' } });
    if (!hasBearerToken(request.headers.authorization, deps.apiToken)) return reply.code(401).send({ error: { code: 'unauthorized' } });
    try {
      const result = await deps.collect('005930');
      if (result.status === 'skipped') return result;
      const { snapshot } = result;
      return { status: result.status, snapshot: { id: snapshot.id, symbol: snapshot.symbol, through: snapshot.through,
        collectedAt: snapshot.collectedAt, calendarVersion: snapshot.calendarVersion, bars: snapshot.dataset.sessions.length,
        rawSha256: snapshot.rawSha256, datasetSha256: snapshot.datasetSha256, candlesSha256: snapshot.candlesSha256,
        revisedDates: snapshot.revisedDates, confirmedAt: snapshot.confirmedAt } };
    } catch (error) {
      return reply.code(503).send({ error: { code: error instanceof BrokerError ? error.code : 'market_data_unavailable' } });
    }
  });
  app.get('/api/v1/strategy/paper-loop/prepared', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!deps.apiToken || !deps.prepare) return reply.code(503).send({ error: { code: 'market_data_disabled' } });
    if (!hasBearerToken(request.headers.authorization, deps.apiToken)) return reply.code(401).send({ error: { code: 'unauthorized' } });
    try { return await deps.prepare(); }
    catch { return reply.code(503).send({ error: { code: 'market_data_unavailable' } }); }
  });
}
