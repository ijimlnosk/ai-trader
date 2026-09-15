export interface TradingSafetyConfig {
  brokerMode: 'paper' | 'live';
  liveTradingEnabled: boolean;
}

// Configuration gate only: never constitutes execution authorization.
export function hasLiveTradingOptIn(config: TradingSafetyConfig): boolean {
  return config.brokerMode === 'live' && config.liveTradingEnabled;
}
