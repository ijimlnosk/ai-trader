import type { FastifyInstance } from 'fastify';
import type { RiskEvaluateRequest } from '@ai-trader/contracts';
import { z } from 'zod';
import type { createRiskEvaluation } from '../../application/risk.ts';

const requestSchema = z.strictObject({
  symbol: z.string().max(32), side: z.enum(['BUY', 'SELL']),
  quantity: z.string().max(26), estimatedPrice: z.string().max(26), confidence: z.string().max(26),
});

export function registerRiskRoute(app: FastifyInstance, evaluate: ReturnType<typeof createRiskEvaluation>) {
  app.register(async (routes) => {
    routes.setErrorHandler((error, request, reply) => {
      const invalid = error instanceof Error && 'statusCode' in error && error.statusCode === 400;
      if (!invalid) request.log.warn({ event: 'risk_evaluation_failed' }, 'Risk context unavailable');
      return reply.code(invalid ? 400 : 503).send({
        error: { code: invalid ? 'invalid_request' : 'risk_context_unavailable' },
      });
    });
    routes.post('/api/v1/risk/evaluate', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      // No JSON-number coercion: precision may already have been lost before reaching the server.
      const parsed = requestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: { code: 'invalid_request' } });
      const input: RiskEvaluateRequest = parsed.data;
      return (await evaluate(input)).decision;
    });
  });
}
