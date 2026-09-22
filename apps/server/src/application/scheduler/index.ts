import { createHash } from 'node:crypto';
import type { MarketDataset } from '../../domain/strategy/marketData.ts';
import { explicitSessionCalendar, isSeoulTradingSession } from '../../domain/scheduler/session.ts';
import type { StrategyService } from '../strategy/index.ts';
import { OrderError } from '../orders/ports.ts';

export interface StrategyRunRecord {
  runKey: string;
  sessionDate: string;
  createdAt: string;
  dataSha256: string;
  result: Awaited<ReturnType<StrategyService>>;
}

export interface StrategyRunRepository {
  get(runKey: string): Promise<StrategyRunRecord | null>;
  put(record: StrategyRunRecord): Promise<void>;
}

export function createMemoryStrategyRunRepository(): StrategyRunRepository {
  const records = new Map<string, StrategyRunRecord>();
  return { get: async (key) => records.get(key) ?? null, put: async (record) => { records.set(record.runKey, record); } };
}

export function createStrategyScheduler(deps: {
  strategy: StrategyService;
  runs: StrategyRunRepository;
  now?: () => Date;
}) {
  return async (runKey: string, sessionDate: string, data: MarketDataset) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(runKey) || !/^\d{8}$/.test(sessionDate)) throw new OrderError('order_context_unavailable');
    const dataSha256 = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const existing = await deps.runs.get(runKey);
    if (existing) {
      if (existing.dataSha256 !== dataSha256) throw new OrderError('idempotency_conflict');
      return existing;
    }
    const calendar = explicitSessionCalendar([sessionDate]);
    const now = (deps.now ?? (() => new Date()))();
    if (!isSeoulTradingSession(now, calendar)) throw new OrderError('order_context_unavailable');
    const result = await deps.strategy(data);
    const record: StrategyRunRecord = { runKey, sessionDate, createdAt: now.toISOString(), dataSha256, result };
    await deps.runs.put(record);
    return record;
  };
}
