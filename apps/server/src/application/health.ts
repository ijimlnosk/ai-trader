import type { HealthResponse } from '@ai-trader/contracts';
import type { Broker } from './broker.ts';

export interface DatabaseHealth {
  checkConnection(): Promise<void>;
}

export function createHealthCheck(database: DatabaseHealth, broker: Broker) {
  return async (): Promise<HealthResponse> => {
    try {
      await database.checkConnection();
      return { status: 'ok', database: 'connected', tradingMode: broker.getMode() };
    } catch {
      return { status: 'error', database: 'disconnected', tradingMode: broker.getMode() };
    }
  };
}
