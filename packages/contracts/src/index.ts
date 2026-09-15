export type HealthResponse = {
  tradingMode: 'paper' | 'live';
} & (
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'disconnected' }
);

/** Domestic quote: KRW price/change, percentage changeRate, cumulative shares volume. */
export interface QuoteResponse {
  symbol: string;
  price: string;
  change: string;
  changeRate: string;
  volume: string;
  /** UTC server receipt time, not exchange trade time. */
  timestamp: string;
}

export interface BrokerStatusResponse {
  provider: 'kis';
  mode: 'paper';
  configured: boolean;
  reachable: boolean;
  error?: 'configuration_error' | 'authentication_error' | 'provider_unavailable'
    | 'provider_invalid_response' | 'invalid_symbol';
}
