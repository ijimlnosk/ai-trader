import { BrokerError } from '../../../application/brokerError.ts';
import { createKisClient, type KisConfiguration, type KisFetch } from './kisClient.ts';
import { createKisTokenProvider } from './kisTokenProvider.ts';
import { envelopeSchema, parseKis } from './kisSchemas.ts';
import { safeKisMessageCode, type KisDiagnosticSink } from './kisDiagnostics.ts';

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
        });
        const envelope = parseKis(envelopeSchema, response.body);
        if (envelope.rt_cd !== '0') {
          if (path.split('?')[0] === '/uapi/domestic-stock/v1/trading/inquire-balance') {
            diagnostic?.({ provider: 'kis', operation: 'inquire_balance', msgCode: safeKisMessageCode(envelope.msg_cd, config, token) });
          }
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
