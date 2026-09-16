import { BrokerError } from '../../../application/brokerError.ts';
import { BrokerOrderRejected } from '../../../application/orders/ports.ts';
import { createKisClient, type KisConfiguration, type KisFetch } from './kisClient.ts';
import { createKisTokenProvider } from './kisTokenProvider.ts';
import { envelopeSchema, parseKis } from './kisSchemas.ts';
import { kisOperationContext, safeKisMessageCode, type KisDiagnosticSink } from './kisDiagnostics.ts';

// One session per composed broker: quotes and accounts share the same token cache.
export function createKisSession(config: KisConfiguration, fetcher?: KisFetch, now = Date.now, diagnostic?: KisDiagnosticSink) {
  const client = createKisClient(config, fetcher);
  const tokens = createKisTokenProvider(client, config, now);
  async function request(method: 'GET' | 'POST', path: string, transactionId: string, continuation = '', body?: Record<string, string>) {
      const token = await tokens.getToken();
      try {
        const response = await client.requestWithMetadata(path, {
          method, ...(body ? { body: JSON.stringify(body) } : {}), headers: {
            'content-type': 'application/json', authorization: `Bearer ${token}`,
            appkey: config.appKey ?? '', appsecret: config.appSecret ?? '',
            tr_id: transactionId, custtype: 'P', tr_cont: continuation,
          },
        }, false, (body, httpStatus) => {
          const result = envelopeSchema.safeParse(body);
          if (result.success && result.data.rt_cd !== '0') {
            diagnostic?.({ provider: 'kis', ...kisOperationContext(path, transactionId), httpStatus,
              msgCode: safeKisMessageCode(result.data.msg_cd, config, token) });
          }
        }, (kind) => {
          // No HTTP response was received; httpStatus 0 distinguishes this from a provider-returned status.
          diagnostic?.({ provider: 'kis', ...kisOperationContext(path, transactionId), httpStatus: 0,
            msgCode: kind === 'timeout' ? 'TIMEOUT' : 'NETWORK_ERROR' });
        });
        const envelope = parseKis(envelopeSchema, response.body);
        if (envelope.rt_cd !== '0') {
          const authentication = ['EGW00121', 'EGW00123'].includes(envelope.msg_cd ?? '');
          if (method === 'POST') {
            if (authentication) tokens.invalidate(token);
            throw new BrokerOrderRejected();
          }
          throw new BrokerError(authentication ? 'authentication_error' : 'provider_unavailable');
        }
        return response;
      } catch (error) {
        if (error instanceof BrokerError && error.code === 'authentication_error') tokens.invalidate(token);
        throw error;
      }
    }
  return {
    isConfigured: client.isConfigured,
    get: (path: string, transactionId: string, continuation = '') => request('GET', path, transactionId, continuation),
    postOrder: (transactionId: 'VTTC0012U' | 'VTTC0011U', body: Record<string, string>) =>
      request('POST', '/uapi/domestic-stock/v1/trading/order-cash', transactionId, '', body),
  };
}
export type KisSession = ReturnType<typeof createKisSession>;
