import { BrokerError } from '../../../application/brokerError.ts';
import { BrokerOrderNotSent } from '../../../application/orders/ports.ts';
import { createKisRequestGate, KisRequestQueueFull } from './kisRequestGate.ts';

export const KIS_PAPER_URL = 'https://openapivts.koreainvestment.com:29443';
export interface KisConfiguration {
  baseUrl: string;
  appKey?: string | undefined;
  appSecret?: string | undefined;
  accountNo?: string | undefined;
  accountProductCode?: string | undefined;
}
export type KisFetch = typeof fetch;

export function createKisClient(config: KisConfiguration, fetcher: KisFetch = fetch, minRequestIntervalMs = 0) {
  const gate = createKisRequestGate(minRequestIntervalMs);
  const isConfigured = () => config.baseUrl === KIS_PAPER_URL && Boolean(config.appKey && config.appSecret);
  async function send(
    path: string, init: RequestInit, authentication = false,
    observeResponse?: (body: unknown, httpStatus: number) => void,
    observeFailure?: (kind: 'timeout' | 'network_error') => void,
    canSend?: () => boolean,
  ) {
    if (!isConfigured()) throw new BrokerError('configuration_error');
    // The application rechecks quote age/session after all queue and token waits, before fetch.
    if (canSend && !canSend()) throw new BrokerOrderNotSent('quote_or_session_expired');
    let response: Response;
    try {
      response = await fetcher(`${config.baseUrl}${path}`, {
        ...init, redirect: 'error', signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      // AbortSignal.timeout aborts with a DOMException named TimeoutError; anything else is a transport failure.
      observeFailure?.(error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network_error');
      throw new BrokerError('provider_unavailable');
    }
    let body: unknown;
    try {
      body = await response.json();
    }
    catch (error) {
      // Failed HTTP responses may be HTML/empty; retain their existing status-based error mapping.
      if (response.ok) {
        if (error instanceof SyntaxError) throw new BrokerError('provider_invalid_response');
        throw new BrokerError('provider_unavailable');
      }
    }
    // Observe provider errors even on 4xx/5xx, before converting to the safe application error.
    observeResponse?.(body, response.status);
    if (response.status === 401 || response.status === 403 ||
        (authentication && response.status === 400)) throw new BrokerError('authentication_error');
    if (!response.ok) throw new BrokerError('provider_unavailable');
    return { body, continuation: response.headers.get('tr_cont') };
  }
  async function requestWithMetadata(...args: Parameters<typeof send>) {
    if (!isConfigured()) throw new BrokerError('configuration_error');
    try { return await gate(() => send(...args)); }
    catch (error) {
      if (args[5] && error instanceof KisRequestQueueFull) throw new BrokerOrderNotSent('broker_request_unavailable');
      throw error;
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
