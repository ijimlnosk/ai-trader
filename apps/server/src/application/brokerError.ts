export type BrokerErrorCode =
  | 'configuration_error' | 'authentication_error' | 'provider_unavailable'
  | 'provider_invalid_response' | 'invalid_symbol';

const messages: Record<BrokerErrorCode, string> = {
  configuration_error: 'Broker configuration is incomplete or unsupported',
  authentication_error: 'Broker authentication failed',
  provider_unavailable: 'Broker provider is unavailable',
  provider_invalid_response: 'Broker provider returned an invalid response',
  invalid_symbol: 'Symbol must contain exactly six digits',
};

// Infrastructure translates external failures into this safe application contract.
export class BrokerError extends Error {
  constructor(public readonly code: BrokerErrorCode) {
    super(messages[code]);
    this.name = 'BrokerError';
  }
}
