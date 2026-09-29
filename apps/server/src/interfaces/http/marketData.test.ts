import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { BrokerError } from '../../application/brokerError.ts';
import type { DailySnapshotCollector } from '../../application/marketData/collect.ts';
import type { PaperLoopPreparer } from '../../application/paperLoop/prepare.ts';
import { registerMarketDataRoutes } from './marketData.ts';

const token = 'x'.repeat(32);
const auth = { authorization: `Bearer ${token}` };
const snapshot = { id: 's1', symbol: '005930', through: '20260928', collectedAt: '2026-09-28T10:00:00.000Z',
  calendarVersion: 'krx-2026-v1', rawSha256: 'a'.repeat(64), datasetSha256: 'b'.repeat(64), candlesSha256: 'c'.repeat(64),
  revisedDates: ['20260923'], dataset: { source: 's', timezone: 'Asia/Seoul' as const, priceBasis: 'raw' as const,
    sessions: ['20260928'], series: [] } };

function app(collect?: DailySnapshotCollector, prepare?: PaperLoopPreparer, apiToken: string | null = token) {
  const server = Fastify();
  registerMarketDataRoutes(server, { collect, prepare, apiToken: apiToken ?? undefined });
  return server;
}

describe('market data routes', () => {
  it('collects with auth and returns a summary without the dataset payload', async () => {
    const collect = vi.fn<DailySnapshotCollector>().mockResolvedValue({ status: 'saved', snapshot });
    const response = await app(collect).inject({ method: 'POST', url: '/api/v1/market/daily-snapshots/collect', headers: auth });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const summary = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== 'dataset'));
    expect(response.json()).toEqual({ status: 'saved', snapshot: { ...summary, bars: 1 } });
    expect(collect).toHaveBeenCalledWith('005930');
  });

  it('returns skip reasons as successful responses', async () => {
    const collect = vi.fn<DailySnapshotCollector>().mockResolvedValue({ status: 'skipped', reason: 'bar_missing' });
    const response = await app(collect).inject({ method: 'POST', url: '/api/v1/market/daily-snapshots/collect', headers: auth });
    expect(response.json()).toEqual({ status: 'skipped', reason: 'bar_missing' });
  });

  it('maps provider failures to safe codes', async () => {
    const collect = vi.fn<DailySnapshotCollector>().mockRejectedValueOnce(new BrokerError('provider_unavailable'))
      .mockRejectedValueOnce(new Error('secret detail'));
    const server = app(collect);
    const first = await server.inject({ method: 'POST', url: '/api/v1/market/daily-snapshots/collect', headers: auth });
    expect([first.statusCode, first.json()]).toEqual([503, { error: { code: 'provider_unavailable' } }]);
    const second = await server.inject({ method: 'POST', url: '/api/v1/market/daily-snapshots/collect', headers: auth });
    expect(second.body).not.toContain('secret');
    expect(second.json()).toEqual({ error: { code: 'market_data_unavailable' } });
  });

  it('rejects missing or wrong credentials before calling use cases', async () => {
    const collect = vi.fn<DailySnapshotCollector>();
    const prepare = vi.fn<PaperLoopPreparer>();
    const server = app(collect, prepare);
    for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
      expect((await server.inject({ method: 'POST', url: '/api/v1/market/daily-snapshots/collect', headers })).statusCode).toBe(401);
      expect((await server.inject({ method: 'GET', url: '/api/v1/strategy/paper-loop/prepared', headers })).statusCode).toBe(401);
    }
    expect(collect).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('is disabled without a token or composed dependencies', async () => {
    for (const server of [app(vi.fn(), vi.fn(), null), app(undefined, undefined)]) {
      const response = await server.inject({ method: 'POST', url: '/api/v1/market/daily-snapshots/collect', headers: auth });
      expect([response.statusCode, response.json()]).toEqual([503, { error: { code: 'market_data_disabled' } }]);
    }
  });

  it('returns the prepared loop input result', async () => {
    const prepare = vi.fn<PaperLoopPreparer>().mockResolvedValue({ status: 'skipped', reason: 'snapshot_missing' });
    const response = await app(undefined, prepare).inject({ method: 'GET', url: '/api/v1/strategy/paper-loop/prepared', headers: auth });
    expect(response.json()).toEqual({ status: 'skipped', reason: 'snapshot_missing' });
  });
});
