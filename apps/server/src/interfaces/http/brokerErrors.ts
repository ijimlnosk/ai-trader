import type { FastifyInstance } from 'fastify';
import { BrokerError, type BrokerErrorCode } from '../../application/brokerError.ts';

const statusCodes: Record<BrokerErrorCode, number> = {
  invalid_symbol: 400, configuration_error: 503, authentication_error: 502,
  provider_unavailable: 503, provider_invalid_response: 502, account_unavailable: 503,
};
export function registerBrokerErrorHandler(app: FastifyInstance, event: string) {
  app.setErrorHandler((error, request, reply) => {
    const known = error instanceof BrokerError;
    const code = known ? error.code : 'internal_error';
    request.log.warn({ event, code }, 'Broker request failed');
    return reply.code(known ? statusCodes[error.code] : 500).send({
      error: { code, message: known ? error.message : 'Internal server error' },
    });
  });
}
