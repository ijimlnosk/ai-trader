import type { BrokerStatusResponse } from '@ai-trader/contracts';
import type { Quote } from '../domain/quote.ts';
import { BrokerError } from './brokerError.ts';

export interface MarketBroker {
  isConfigured(): boolean;
  getQuote(symbol: string): Promise<Quote>;
}

export function createMarket(broker: MarketBroker) {
  return {
    async getQuote(symbol: string): Promise<Quote> {
      if (symbol.length !== 6 || !/^[0-9]{6}$/.test(symbol)) throw new BrokerError('invalid_symbol');
      return broker.getQuote(symbol);
    },
    async getStatus(): Promise<BrokerStatusResponse> {
      const status = { provider: 'kis', mode: 'paper', configured: broker.isConfigured(), reachable: false } as const;
      if (!status.configured) return { ...status, error: 'configuration_error' };
      try {
        await broker.getQuote('005930');
        return { ...status, reachable: true };
      } catch (error) {
        if (!(error instanceof BrokerError)) throw error;
        return { ...status, error: error.code };
      }
    },
  };
}
