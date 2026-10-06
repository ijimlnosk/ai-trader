import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../../application/auth/index.ts';
import { AuthError, type SessionIdentity } from '../../application/auth/ports.ts';
import { ControlError, type TradingControls } from '../../application/controls/index.ts';
import type { NewsQuery } from '../../application/news/query.ts';
import type { ConsoleQueries } from '../../application/console/index.ts';
import type { InsightQuery } from '../../application/console/insights.ts';
import type { createHealthCheck } from '../../application/health.ts';
import type { createMarket } from '../../application/market.ts';
import type { createPortfolioQuery } from '../../application/portfolio.ts';
import { bearerToken } from './auth.ts';

const query = z.strictObject({ limit: z.coerce.number().int().min(1).max(100).default(20) });
const noQuery = z.strictObject({});
const controlBody = z.strictObject({ enabled: z.boolean(), password: z.string().min(1).max(128).optional() });
const identities = new WeakMap<FastifyRequest, SessionIdentity>();
export function registerUserConsole(app: FastifyInstance, deps: {
  auth: AuthService | undefined; account: string; queries: ConsoleQueries | undefined;
  portfolio: ReturnType<typeof createPortfolioQuery>; market: ReturnType<typeof createMarket>; health: ReturnType<typeof createHealthCheck>;
  controls?: TradingControls | undefined;
  news?: NewsQuery | undefined;
  insights?: InsightQuery | undefined;
}) {
  app.register(async routes => {
    routes.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!deps.auth || !deps.queries || !deps.account) return reply.code(503).send({ error: { code: 'console_disabled' } });
      const identity = await deps.auth.authenticate(bearerToken(request.headers.authorization));
      // This runtime has one broker/account. Neither URL/query nor browser headers choose scope.
      if (identity.executionAccount !== deps.account) throw new AuthError('account_not_connected');
      identities.set(request, identity);
    });
    routes.setErrorHandler((error, _request, reply) => {
      const code = error instanceof z.ZodError ? 'invalid_request' : error instanceof AuthError || error instanceof ControlError ? error.code : 'console_unavailable';
      const statuses: Record<string, number> = { invalid_request: 400, unauthorized: 401, account_not_connected: 403,
        password_incorrect: 403, control_not_allowed: 409, login_rate_limited: 429 };
      const status = statuses[code] ?? 503;
      if (status === 429) reply.header('Retry-After', '900');
      return reply.code(status).send({ error: { code } });
    });
    routes.get<{ Params: { name: string } }>('/api/v1/me/console/:name', async (request, reply) => {
      const name = request.params.name;
      if (['orders', 'loop-runs', 'snapshots', 'news'].includes(name)) {
        const { limit } = query.parse(request.query);
        if (name === 'news') return deps.news ? deps.news(limit) : { items: [], usage: null };
        if (name === 'orders') return { items: await deps.queries!.orders(limit) };
        if (name === 'loop-runs') return { items: await deps.queries!.loopRuns(limit) };
        return { items: await deps.queries!.snapshots(limit) };
      }
      noQuery.parse(request.query);
      if (name === 'status') return deps.queries!.status();
      if (name === 'portfolio') return deps.portfolio();
      if (name === 'broker-status') return deps.market.getStatus();
      if (name === 'health') return deps.health();
      if (name === 'controls' && deps.controls) return deps.controls.status();
      if (name === 'plan') return deps.queries!.plan();
      if (name === 'insights' && deps.insights) return deps.insights();
      return reply.code(404).send({ error: { code: 'not_found' } });
    });
    // Owner pause/resume of automatic paper trading only. Resume requires the password again.
    routes.post('/api/v1/me/controls/auto-trading', { bodyLimit: 1024 }, async (request, reply) => {
      if (!deps.controls) return reply.code(503).send({ error: { code: 'console_unavailable' } });
      const body = controlBody.parse(request.body);
      const identity = identities.get(request)!;
      if (body.enabled) await deps.controls.resume(identity, body.password);
      else await deps.controls.pause(identity);
      return deps.controls.status();
    });
  });
}
