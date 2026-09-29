import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../../application/auth/index.ts';
import { AuthError } from '../../application/auth/ports.ts';
import type { ConsoleQueries } from '../../application/console/index.ts';
import type { createHealthCheck } from '../../application/health.ts';
import type { createMarket } from '../../application/market.ts';
import type { createPortfolioQuery } from '../../application/portfolio.ts';
import { bearerToken } from './auth.ts';

const query = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const noQuery = z.strictObject({});
export function registerUserConsole(app: FastifyInstance, deps: {
  auth: AuthService | undefined; account: string; queries: ConsoleQueries | undefined;
  portfolio: ReturnType<typeof createPortfolioQuery>; market: ReturnType<typeof createMarket>; health: ReturnType<typeof createHealthCheck>;
}) {
  app.register(async routes => {
    routes.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!deps.auth || !deps.queries || !deps.account) return reply.code(503).send({ error: { code: 'console_disabled' } });
      const identity = await deps.auth.authenticate(bearerToken(request.headers.authorization));
      // This runtime has one broker/account. Neither URL/query nor browser headers choose scope.
      if (identity.executionAccount !== deps.account) throw new AuthError('account_not_connected');
    });
    routes.setErrorHandler((error, _request, reply) => {
      const code = error instanceof z.ZodError ? 'invalid_request' : error instanceof AuthError ? error.code : 'console_unavailable';
      return reply.code(code === 'invalid_request' ? 400 : code === 'unauthorized' ? 401 : code === 'account_not_connected' ? 403 : 503)
        .send({ error: { code } });
    });
    routes.get<{ Params: { name: string } }>('/api/v1/me/console/:name', async (request, reply) => {
      const name = request.params.name;
      if (['orders', 'loop-runs', 'snapshots'].includes(name)) {
        const { limit } = query.parse(request.query);
        if (name === 'orders') return { items: await deps.queries!.orders(limit) };
        if (name === 'loop-runs') return { items: await deps.queries!.loopRuns(limit) };
        return { items: await deps.queries!.snapshots(limit) };
      }
      noQuery.parse(request.query);
      if (name === 'status') return deps.queries!.status();
      if (name === 'portfolio') return deps.portfolio();
      if (name === 'broker-status') return deps.market.getStatus();
      if (name === 'health') return deps.health();
      return reply.code(404).send({ error: { code: 'not_found' } });
    });
  });
}
