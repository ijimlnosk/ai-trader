import type { StrategyService } from '../../application/strategy/index.ts';
import { strategyInputSchema } from '../../application/strategy/input.ts';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { orderResponse, type OrderServices } from '../../application/orders/index.ts';
import { orderInputSchema } from '../../application/orders/input.ts';
import { OrderError } from '../../application/orders/ports.ts';

export function registerOrderRoutes(app: FastifyInstance, services: OrderServices | undefined, apiToken: string | undefined, strategy?: StrategyService) {
  app.register(async (routes) => {
    routes.addHook('onRequest', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!services || !apiToken) return reply.code(503).send({ error: { code: 'execution_disabled' } });
      const provided = Buffer.from(request.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${apiToken}`);
      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return reply.code(401).send({ error: { code: 'unauthorized' } });
      }
    });
    routes.setErrorHandler((error, request, reply) => {
      const badRequest = error instanceof z.ZodError || (error instanceof Error && 'statusCode' in error && error.statusCode === 400);
      const code = error instanceof OrderError ? error.code : badRequest ? 'invalid_request' : 'order_service_unavailable';
      const status = code === 'invalid_request' ? 400 : code === 'order_not_found' ? 404
        : ['idempotency_conflict', 'account_busy', 'order_conflict', 'reconciliation_required', 'invalid_reconciliation'].includes(code) ? 409 : 503;
      request.log.warn({ event: 'order_request_failed', code }, 'Order request failed');
      return reply.code(status).send({ error: { code } });
    });
    routes.post('/api/v1/strategy/evaluate', async (request, reply) => {
      if (!strategy) return reply.code(503).send({ error: { code: 'strategy_unavailable' } });
      const input = strategyInputSchema.parse(request.body);
      return strategy(input.data, input.executeSymbol);
    });
    routes.post('/api/v1/orders', async (request, reply) => {
      const key = z.string().uuid().transform((value) => value.toLowerCase()).parse(request.headers['idempotency-key']);
      const input = orderInputSchema.parse(request.body);
      const order = await services!.submit(key, input);
      reply.header('Location', `/api/v1/orders/${order.id}`);
      return reply.code(['PREPARING', 'SUBMITTING', 'UNKNOWN', 'SUBMITTED', 'PARTIALLY_FILLED'].includes(order.brokerStatus) ? 202 : 200)
        .send(orderResponse(order));
    });
    routes.get<{ Params: { id: string } }>('/api/v1/orders/:id', async (request) => {
      return orderResponse(await services!.get(z.string().uuid().parse(request.params.id)));
    });
    routes.post<{ Params: { id: string } }>('/api/v1/orders/:id/reconcile', async (request) => {
      const input = z.strictObject({ brokerOrderId: z.string().max(20).regex(/^[0-9]+$/).optional() }).parse(request.body ?? {});
      return orderResponse(await services!.reconcile(z.string().uuid().parse(request.params.id),
        input.brokerOrderId === undefined ? undefined : BigInt(input.brokerOrderId).toString()));
    });
  });
}
