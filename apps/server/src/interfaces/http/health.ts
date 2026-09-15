import type { FastifyInstance } from 'fastify';
import type { createHealthCheck } from '../../application/health.ts';

export function registerHealthRoute(app: FastifyInstance, checkHealth: ReturnType<typeof createHealthCheck>) {
  app.get('/health', async (request, reply) => {
    const result = await checkHealth();
    if (result.status === 'error') request.log.warn({ event: 'database_health_failed' }, 'Database unavailable');
    return reply.code(result.status === 'ok' ? 200 : 503).send(result);
  });
}
