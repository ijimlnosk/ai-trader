import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { datasetSchema } from '../../application/strategy/input.ts';

const inputSchema = z.strictObject({ runKey: z.string().min(1).max(120), sessionDate: z.string().regex(/^\d{8}$/), data: datasetSchema });
type Scheduler = (runKey: string, sessionDate: string, data: z.infer<typeof datasetSchema>) => Promise<unknown>;

export function registerStrategySchedulerRoute(app: FastifyInstance, scheduler: Scheduler, apiToken?: string) {
  app.post('/api/v1/strategy/schedule', async (request, reply) => {
    if (!apiToken) return reply.code(503).send({ error: { code: 'scheduler_disabled' } });
    const provided = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${apiToken}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return reply.code(401).send({ error: { code: 'unauthorized' } });
    try {
      const input = inputSchema.parse(request.body);
      return await scheduler(input.runKey, input.sessionDate, input.data);
    } catch (error) {
      const code = error instanceof z.ZodError ? 'invalid_request' : error instanceof Error && 'code' in error ? String(error.code) : 'scheduler_unavailable';
      return reply.code(code === 'invalid_request' ? 400 : code === 'idempotency_conflict' ? 409 : 503).send({ error: { code } });
    }
  });
}
