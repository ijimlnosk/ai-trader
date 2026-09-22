import { describe, expect, it, vi } from 'vitest';
import { createMemoryStrategyRunRepository, createStrategyScheduler } from './index.ts';
import type { MarketDataset } from '../../domain/strategy/marketData.ts';

const data = { source: 'test', timezone: 'Asia/Seoul', priceBasis: 'raw', sessions: ['20260922'],
  series: [{ symbol: '005930', candles: [{ date: '20260922', open: '100', high: '101', low: '99', close: '100', volume: '1' }] }] } as unknown as MarketDataset;
const result = { mode: 'paper' as const, dataSha256: 'x', configuration: {}, evaluations: [], order: null } as never;

describe('strategy scheduler', () => {
  it('runs only during an explicitly declared session and replays idempotently', async () => {
    const strategy = vi.fn().mockResolvedValue(result);
    const scheduler = createStrategyScheduler({ strategy, runs: createMemoryStrategyRunRepository(), now: () => new Date('2026-09-22T01:00:00.000Z') });
    const first = await scheduler('run-1', '20260922', data);
    const second = await scheduler('run-1', '20260922', data);
    expect(second).toEqual(first);
    expect(strategy).toHaveBeenCalledTimes(1);
  });

  it('rejects a run outside the Seoul session', async () => {
    const scheduler = createStrategyScheduler({ strategy: vi.fn(), runs: createMemoryStrategyRunRepository(), now: () => new Date('2026-09-21T23:00:00.000Z') });
    await expect(scheduler('run-1', '20260922', data)).rejects.toMatchObject({ code: 'order_context_unavailable' });
  });
});
