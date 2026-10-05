import type { FastifyInstance } from 'fastify';
import { hasBearerToken } from './serviceToken.ts';

/** Legacy service reads are private too; user sessions authorize only /me/console routes. */
export function protectBrokerReads(app: FastifyInstance, tokens: readonly (string | undefined)[]) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const allowed = tokens.some(token => !!token && hasBearerToken(request.headers.authorization, token));
    if (!allowed) return reply.code(401).send({ error: { code: 'unauthorized' } });
  });
}
