import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { createConsoleQueries, type ConsoleReadRepository } from '../../application/console/index.ts';
import type { PaperLoopRun } from '../../application/paperLoop/ports.ts';
import { registerConsoleRoutes } from './console.ts';

const token = 'r'.repeat(32);
const auth = { authorization: `Bearer ${token}` };
const flags = { tradingMode: 'paper' as const, liveTradingEnabled: false, paperExecutionEnabled: false, paperLoopEnabled: false,
  killSwitchEnabled: false, marketDataScheduleEnabled: true, paperLoopScheduleEnabled: false, momentumExecutionEnabled: false };
const run = { id: 'r1', status: 'COMPLETE', reason: null, order: null, createdAt: 'c', updatedAt: 'u',
  input: { runKey: 'loop-1', sessionDate: '20260929', dataSha256: 'd'.repeat(64), dataRef: 'ref' },
  result: { evaluations: [{ signal: { symbol: '005930', reason: 'TREND_EXIT', proposal: { side: 'SELL', quantity: '1' } },
    decision: { approved: true, reasons: [] } }] } } as unknown as PaperLoopRun;

function app(repository: Partial<ConsoleReadRepository> = {}, readToken: string | null = token) {
  const server = Fastify();
  const listOrders = vi.fn<ConsoleReadRepository['listOrders']>(async () => []);
  const listSnapshots = vi.fn<ConsoleReadRepository['listSnapshots']>(async () => []);
  const repo = { listOrders, listLoopRuns: vi.fn(async () => [run]), listSnapshots, latestPlanRun: async () => null, ...repository };
  registerConsoleRoutes(server, createConsoleQueries({ repository: repo, flags, now: () => new Date('2026-09-29T06:00:00Z') }), readToken ?? undefined);
  return { server, repo, listOrders, listSnapshots };
}

describe('console routes', () => {
  it('returns runtime flags and calendar coverage without secrets', async () => {
    const response = await app().server.inject({ url: '/api/v1/console/status', headers: auth });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({ checkedAt: '2026-09-29T06:00:00.000Z', ...flags,
      calendar: { version: 'krx-2026-v2', from: '20260102', through: '20261230' } });
  });

  it('summarizes loop runs without their input dataset', async () => {
    const response = await app().server.inject({ url: '/api/v1/console/loop-runs', headers: auth });
    expect(response.json()).toEqual({ items: [{ id: 'r1', runKey: 'loop-1', sessionDate: '20260929', status: 'COMPLETE',
      reason: null, dataSha256: 'd'.repeat(64), dataRef: 'ref', signal: { reason: 'TREND_EXIT', side: 'SELL', quantity: '1' },
      decision: { approved: true, reasons: [] }, order: null, createdAt: 'c', updatedAt: 'u' }] });
    expect(response.body).not.toContain('candles');
  });

  it('bounds limit and defaults to 20', async () => {
    const { server, listOrders } = app();
    await server.inject({ url: '/api/v1/console/orders', headers: auth });
    await server.inject({ url: '/api/v1/console/orders?limit=100', headers: auth });
    expect(listOrders.mock.calls).toEqual([[20], [100]]);
    for (const limit of ['0', '101', 'x', '1.5']) {
      expect((await server.inject({ url: `/api/v1/console/orders?limit=${limit}`, headers: auth })).statusCode).toBe(400);
    }
    expect((await server.inject({ url: '/api/v1/console/orders?other=1', headers: auth })).statusCode).toBe(400);
  });

  it('requires the read token and is disabled without one', async () => {
    const { server, listSnapshots } = app();
    for (const headers of [{}, { authorization: 'Bearer wrong' }]) {
      expect((await server.inject({ url: '/api/v1/console/snapshots', headers })).statusCode).toBe(401);
    }
    expect(listSnapshots).not.toHaveBeenCalled();
    const disabled = await app({}, null).server.inject({ url: '/api/v1/console/status', headers: auth });
    expect([disabled.statusCode, disabled.json()]).toEqual([503, { error: { code: 'console_disabled' } }]);
  });

  it('maps repository failures to a safe code', async () => {
    const { server } = app({ listSnapshots: vi.fn(async () => { throw new Error('postgres://secret'); }) });
    const response = await server.inject({ url: '/api/v1/console/snapshots', headers: auth });
    expect([response.statusCode, response.json()]).toEqual([503, { error: { code: 'console_unavailable' } }]);
  });

  it('exposes no write methods', async () => {
    const response = await app().server.inject({ method: 'POST', url: '/api/v1/console/orders', headers: auth });
    expect(response.statusCode).toBe(404);
  });
});
