import { BrokerError } from '../../../application/brokerError.ts';
import { createKisClient, type KisConfiguration, type KisFetch } from './kisClient.ts';
import { createKisTokenProvider } from './kisTokenProvider.ts';
import { envelopeSchema, parseKis } from './kisSchemas.ts';
import { kisOperationContext, safeKisMessageCode, type KisDiagnosticSink } from './kisDiagnostics.ts';

// One session per composed broker: quotes and accounts share the same token cache.
export function createKisSession(config: KisConfiguration, fetcher?: KisFetch, now = Date.now, diagnostic?: KisDiagnosticSink) {
  const client = createKisClient(config, fetcher);
  const tokens = createKisTokenProvider(client, config, now);
  return {
    isConfigured: client.isConfigured,
    async get(path: string, transactionId: string, continuation = '') {
      const token = await tokens.getToken();
      try {
        const response = await client.requestWithMetadata(path, {
          method: 'GET', headers: {
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
          throw new BrokerError(authentication ? 'authentication_error' : 'provider_unavailable');
        }
        return response;
      } catch (error) {
        if (error instanceof BrokerError && error.code === 'authentication_error') tokens.invalidate(token);
        throw error;
      }
    },
  };
}
export type KisSession = ReturnType<typeof createKisSession>;
