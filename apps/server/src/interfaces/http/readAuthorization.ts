import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/** Legacy service reads are private too; user sessions authorize only /me/console routes. */
export function protectBrokerReads(app: FastifyInstance, tokens: readonly (string | undefined)[]) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const supplied = Buffer.from(request.headers.authorization ?? '');
    const allowed = tokens.some(token => {
      if (!token) return false;
      const expected = Buffer.from(`Bearer ${token}`);
      return supplied.length === expected.length && timingSafeEqual(supplied, expected);
    });
    if (!allowed) return reply.code(401).send({ error: { code: 'unauthorized' } });
  });
}
