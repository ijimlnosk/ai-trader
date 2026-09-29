import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { sessionResponse, type AuthService } from '../../application/auth/index.ts';
import { AuthError } from '../../application/auth/ports.ts';

export function bearerToken(header: string | undefined): string | undefined {
  return /^Bearer ([a-f0-9]{64})$/.exec(header ?? '')?.[1];
}
export function registerAuthRoutes(app: FastifyInstance, auth: AuthService | undefined, account: string) {
  app.register(async routes => {
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!auth) return reply.code(503).send({ error: { code: 'auth_unavailable' } });
    });
    routes.setErrorHandler((error, _request, reply) => {
      const code = error instanceof z.ZodError ? 'invalid_request' : error instanceof AuthError ? error.code : 'auth_unavailable';
      const status = code === 'invalid_request' ? 400 : code === 'unauthorized' ? 401 : code === 'login_rate_limited' ? 429 : 503;
      if (status === 429) reply.header('Retry-After', '900');
      return reply.code(status).send({ error: { code } });
    });
    routes.post('/api/v1/auth/login', { bodyLimit: 4096 }, async request => auth!.login(request.body));
    routes.get('/api/v1/auth/me', async request => sessionResponse(await auth!.authenticate(bearerToken(request.headers.authorization)), account));
    routes.post('/api/v1/auth/logout', async (request, reply) => {
      await auth!.logout(bearerToken(request.headers.authorization));
      return reply.code(204).send();
    });
  });
}
