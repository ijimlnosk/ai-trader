import { describe, expect, it, vi } from 'vitest';
import { createMemoryStrategyRunRepository } from '../scheduler/index.ts';
import type { UniverseDatasetBuilder } from '../marketData/universeDataset.ts';
import { createMomentumPlanRunner } from './momentumPlan.ts';

const dates: string[] = [];
for (const day = new Date('2026-09-28T00:00:00Z'); dates.length < 130; day.setUTCDate(day.getUTCDate() - 1)) {
  if (![0, 6].includes(day.getUTCDay())) dates.unshift(day.toISOString().slice(0, 10).replaceAll('-', ''));
}
const candles = dates.map((date, i) => { const close = String(Math.round(10000 * 1.002 ** i)); return { date, open: close, high: close, low: close, close, volume: '1' }; });
const build: UniverseDatasetBuilder = async () => ({ status: 'ready', sessionDate: '20260929', excluded: [{ symbol: '000660', reason: 'snapshot_unconfirmed' }],
  data: { source: 'fixture', timezone: 'Asia/Seoul', priceBasis: 'raw', sessions: dates, series: [{ symbol: '005930', candles }] } });
const portfolio = { cash: '10000000', totalEvaluation: '10000000', totalPurchaseAmount: '0', totalProfitLoss: '0', totalProfitLossRate: '0', positions: [] };
const context = { cash: '10000000', totalEquity: '10000000', dailyRealizedPnl: '0', openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: false };

function setup(riskContext: typeof context | null = context) {
  const runs = createMemoryStrategyRunRepository();
  const account = { getPortfolio: vi.fn(async () => portfolio) };
  const risk = { getRiskContext: vi.fn(async () => riskContext) };
  const run = createMomentumPlanRunner({ build, account, risk, runs, now: () => new Date('2026-09-29T00:05:00Z') });
  return { runs, account, run };
}

describe('momentum plan runner', () => {
  it('stores an order-free momentum evaluation of the universe and is idempotent per dataset', async () => {
    const s = setup();
    const first = await s.run();
    expect(first).toMatchObject({ status: 'saved', scanned: 1, excluded: 1 });
    if (first.status !== 'saved') throw new Error('expected saved');
    expect(first.runKey).toMatch(/^plan-momentum-20260929-[0-9a-f]{12}$/);
    const record = await s.runs.get(first.runKey);
    expect(record!.result.evaluations[0]).toMatchObject({ signal: { strategyId: 'momentum-rotation', symbol: '005930' }, decision: null, context });
    expect(record!.result.order).toBeNull();
    expect(await s.run()).toEqual(first);
    expect(s.account.getPortfolio).toHaveBeenCalledTimes(1);
  });

  it('skips without saving when account and risk inputs disagree', async () => {
    const s = setup({ ...context, cash: '1' });
    expect(await s.run()).toEqual({ status: 'skipped', reason: 'account_context_unavailable' });
  });
});
