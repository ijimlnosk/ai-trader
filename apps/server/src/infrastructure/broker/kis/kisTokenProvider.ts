import { BrokerError } from '../../../application/brokerError.ts';
import type { KisClient, KisConfiguration } from './kisClient.ts';
import { parseKis, tokenSchema } from './kisSchemas.ts';

export function createKisTokenProvider(client: KisClient, config: KisConfiguration, now = Date.now) {
  let cached: { token: string; expiresAt: number } | undefined;
  let pending: Promise<string> | undefined;
  async function issue(): Promise<string> {
    const startedAt = now();
    const data = parseKis(tokenSchema, await client.request('/oauth2/tokenP', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: config.appKey, appsecret: config.appSecret }),
    }, true));
    const expiresAt = startedAt + data.expires_in * 1000;
    if (now() >= expiresAt - 60_000) throw new BrokerError('provider_invalid_response');
    cached = { token: data.access_token, expiresAt };
    return cached.token;
  }
  return {
    getToken(): Promise<string> {
      if (cached && now() < cached.expiresAt - 60_000) return Promise.resolve(cached.token);
      pending ??= issue().finally(() => { pending = undefined; });
      return pending;
    },
    invalidate(token: string) {
      // A late failure for an old token must not evict a newly issued token.
      if (cached?.token === token) cached = undefined;
    },
  };
}
