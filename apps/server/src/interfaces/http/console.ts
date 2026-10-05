import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CONSOLE_MAX_LIMIT, type ConsoleQueries } from '../../application/console/index.ts';
import { hasBearerToken } from './serviceToken.ts';

const querySchema = z.strictObject({ limit: z.coerce.number().int().min(1).max(CONSOLE_MAX_LIMIT).default(20) });

/** Read-only console endpoints behind a token that cannot authorize orders. */
export function registerConsoleRoutes(app: FastifyInstance, queries: ConsoleQueries | undefined, readToken?: string) {
  app.register(async (routes) => {
    routes.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!readToken || !queries) return reply.code(503).send({ error: { code: 'console_disabled' } });
      if (!hasBearerToken(request.headers.authorization, readToken)) return reply.code(401).send({ error: { code: 'unauthorized' } });
    });
    routes.setErrorHandler(async (error, _request, reply) => {
      if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: 'invalid_request' } });
      return reply.code(503).send({ error: { code: 'console_unavailable' } });
    });
    routes.get('/api/v1/console/status', async () => queries!.status());
    routes.get('/api/v1/console/orders', async (request) => ({ items: await queries!.orders(querySchema.parse(request.query).limit) }));
    routes.get('/api/v1/console/loop-runs', async (request) => ({ items: await queries!.loopRuns(querySchema.parse(request.query).limit) }));
    routes.get('/api/v1/console/snapshots', async (request) => ({ items: await queries!.snapshots(querySchema.parse(request.query).limit) }));
  });
}
