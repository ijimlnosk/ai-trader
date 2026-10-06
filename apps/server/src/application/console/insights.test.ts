import { describe, expect, it } from 'vitest';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import { createInsightQuery, type InsightReadRepository } from './insights.ts';

const signal = (symbol: string, rank: number | null, close: string, reason: string, quantity: string | null = null) => ({ signal: {
  strategyId: 'momentum-rotation', version: '1', symbol, evaluatedAt: '', source: 's', reason, heldQuantity: '0', score: [],
  proposal: quantity ? { symbol, side: 'BUY', quantity, estimatedPrice: close, confidence: '1', createdAt: '' } : null,
  metrics: rank === null && reason === 'INSUFFICIENT_HISTORY' ? null : { momentum: 1.0168067, trendMa: 194267.4, close, rank } }, context: {} });
const run = { runKey: 'plan-momentum-20261006-x', sessionDate: '20261006', createdAt: '', dataSha256: 'd',
  result: { evaluations: [signal('018260', 4, '219500', 'MOMENTUM_ENTRY', '4'), signal('005930', null, '0', 'INSUFFICIENT_HISTORY'),
    signal('066570', 1, '216000', 'MOMENTUM_ENTRY', '4'), signal('010950', null, '45000', 'NO_ENTRY')] } } as unknown as StrategyRunRecord;
const repository: InsightReadRepository = {
  dailyCoverage: async () => [{ through: '20261002', symbols: 54, minBars: 184, maxBars: 184 }],
  minuteCoverage: async () => [{ sessionDate: '20261002', symbols: 54, minBars: 391, maxBars: 391 }],
  recentDisclosures: async () => [{ receiptNo: '20261006000001', symbol: '066570', receiptDate: '20261006', reportName: '풍문또는보도에대한해명(미확정)' }],
  recentTakeProfit: async () => [],
};

describe('console insights', () => {
  it('ranks momentum rows, rounds momentum and marks what KRW 500,000 can buy', async () => {
    const insights = await createInsightQuery({ latestPlanRun: async () => run }, repository)();
    expect(insights.momentum?.smallAccount).toEqual({ capitalKrw: '500000', budgetKrw: '45000' });
    expect(insights.momentum?.rows.map((row) => [row.symbol, row.rank, row.momentumPct, row.trendMa, row.proposedQuantity, row.affordableSmall])).toEqual([
      ['066570', 1, 101.7, '194267', '4', false], ['018260', 4, 101.7, '194267', '4', false],
      ['005930', null, null, null, null, false], ['010950', null, 101.7, '194267', null, true]]);
    expect(insights.disclosures[0]).toMatchObject({ name: 'LG전자', reportName: '풍문또는보도에대한해명(미확정)' });
  });

  it('returns no momentum section without a plan', async () => {
    expect((await createInsightQuery({ latestPlanRun: async () => null }, repository)()).momentum).toBeNull();
  });
});
