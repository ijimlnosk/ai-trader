import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PaperLoop } from '../../application/paperLoop/index.ts';
import { PaperLoopError } from '../../application/paperLoop/ports.ts';
import { hasBearerToken } from './serviceToken.ts';

export function registerPaperLoopRoute(app: FastifyInstance, tick: PaperLoop | undefined, apiToken?: string) {
  app.post('/api/v1/strategy/paper-loop/tick', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (!apiToken || !tick) return reply.code(503).send({ error: { code: 'loop_disabled' } });
    if (!hasBearerToken(request.headers.authorization, apiToken)) return reply.code(401).send({ error: { code: 'unauthorized' } });
    try { return await tick(request.body); }
    catch (error) {
      const code = error instanceof z.ZodError ? 'invalid_request'
        : error instanceof PaperLoopError ? error.code : 'loop_unavailable';
      return reply.code(code === 'invalid_request' ? 400 : ['loop_conflict', 'loop_busy'].includes(code) ? 409 : 503)
        .send({ error: { code } });
    }
  });
}
