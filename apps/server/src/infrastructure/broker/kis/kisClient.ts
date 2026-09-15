import { BrokerError } from '../../../application/brokerError.ts';

export const KIS_PAPER_URL = 'https://openapivts.koreainvestment.com:29443';
export interface KisConfiguration {
  baseUrl: string;
  appKey?: string | undefined;
  appSecret?: string | undefined;
  accountNo?: string | undefined;
  accountProductCode?: string | undefined;
}
export type KisFetch = typeof fetch;

export function createKisClient(config: KisConfiguration, fetcher: KisFetch = fetch) {
  const isConfigured = () => config.baseUrl === KIS_PAPER_URL && Boolean(config.appKey && config.appSecret);
  async function requestWithMetadata(path: string, init: RequestInit, authentication = false) {
    if (!isConfigured()) throw new BrokerError('configuration_error');
    let response: Response;
    try {
      response = await fetcher(`${config.baseUrl}${path}`, {
        ...init, redirect: 'error', signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BrokerError('provider_unavailable');
    }
    if (response.status === 401 || response.status === 403 ||
        (authentication && response.status === 400)) throw new BrokerError('authentication_error');
    if (!response.ok) throw new BrokerError('provider_unavailable');
    try {
      const body: unknown = await response.json();
      return { body, continuation: response.headers.get('tr_cont') };
    }
    catch (error) {
      if (error instanceof SyntaxError) throw new BrokerError('provider_invalid_response');
      throw new BrokerError('provider_unavailable');
    }
  }
  return {
    isConfigured, requestWithMetadata,
    async request(path: string, init: RequestInit, authentication = false): Promise<unknown> {
      return (await requestWithMetadata(path, init, authentication)).body;
    },
  };
}
export type KisClient = ReturnType<typeof createKisClient>;
