import { expect, it } from 'vitest';
import { createConsoleQueries } from './index.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';

const context = { cash: '1000000', totalEquity: '10000000', dailyRealizedPnl: '0', openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: false };
const signal = (symbol: string, side: 'BUY' | 'SELL' | null, volumeRatio: number) => ({ strategyId: 'ema-cross', version: '1', configId: 'c', symbol,
  evaluatedAt: 't', source: 's', screen: { symbol, included: true, reasons: [], averageTurnover: '1' },
  indicators: { ema20: 101, ema60: 100, previousEma20: 99, previousEma60: 100, rsi14: 60, atr14: 1, volumeRatio, trend: 'up' as const },
  reason: side ? 'BULLISH_CROSS' : 'NO_ENTRY', proposal: side ? { symbol, side, quantity: '2', estimatedPrice: '100000', confidence: '1', createdAt: '2026-09-29T06:30:00.000Z' } : null });
const run = { runKey: 'plan-20260930-abc', sessionDate: '20260930', createdAt: '2026-09-30T00:05:30.000Z', dataSha256: 'd',
  result: { evaluations: [signal('000660', 'BUY', 1.5), signal('005930', null, 1), signal('035420', 'BUY', 2.5)]
    .map((s) => ({ signal: s, context, policy: {}, decision: null, orderKey: 'k' })) } } as unknown as StrategyRunRecord;
const flags = { tradingMode: 'paper' as const, liveTradingEnabled: false, paperExecutionEnabled: true, paperLoopEnabled: true,
  killSwitchEnabled: false, marketDataScheduleEnabled: true, paperLoopScheduleEnabled: true, momentumExecutionEnabled: false };
const repository = (latest: StrategyRunRecord | null) => ({ listOrders: async () => [], listLoopRuns: async () => [], listSnapshots: async () => [],
  latestPlanRun: async (prefix: string) => (latest && latest.runKey.startsWith(prefix) ? latest : null) });

it('derives the ranked plan with names and risk results from the stored run', async () => {
  const response = await createConsoleQueries({ repository: repository(run), flags }).plan();
  expect(response.plans).toHaveLength(1);
  expect(response.plans[0]).toMatchObject({ strategyId: 'ema-cross', runKey: 'plan-20260930-abc', sessionDate: '20260930', scanned: 3, universeSize: 54,
    reasons: { BULLISH_CROSS: 2, NO_ENTRY: 1 } });
  expect(response.plans[0]!.items).toEqual([
    { rank: 1, symbol: '035420', name: 'NAVER', side: 'BUY', quantity: '2', estimatedPrice: '100000', reason: 'BULLISH_CROSS', approved: true, rejections: [], news: null },
    { rank: 2, symbol: '000660', name: 'SK하이닉스', side: 'BUY', quantity: '2', estimatedPrice: '100000', reason: 'BULLISH_CROSS', approved: true, rejections: [], news: null },
  ]);
});

it('returns no plans without plan runs', async () => {
  expect(await createConsoleQueries({ repository: repository(null), flags }).plan()).toEqual({ plans: [], aiUsage: null });
});
