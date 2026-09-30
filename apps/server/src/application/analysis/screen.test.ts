import { describe, expect, it, vi } from 'vitest';
import { memoryQuota } from '../../../test/quotaFixtures.ts';
import type { StoredNews } from '../news/ports.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import type { AssessmentRecord } from './screen.ts';
import { AI_COST_PROVIDER, createNewsScreener } from './screen.ts';
import type { NewsAssessor } from './ports.ts';

const context = { cash: '10000000', totalEquity: '10000000', dailyRealizedPnl: '0', openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: false };
const signal = (symbol: string, side: 'BUY' | 'SELL' | null, held = '0') => ({ strategyId: 'momentum-rotation', version: '1', symbol,
  evaluatedAt: '2026-10-06T06:30:00.000Z', source: 's', reason: side ? 'MOMENTUM_ENTRY' : 'HOLD_POSITION', heldQuantity: held, score: [0.1], metrics: null,
  proposal: side ? { symbol, side, quantity: '1', estimatedPrice: '100000', confidence: '1', createdAt: '2026-10-06T06:30:00.000Z' } : null });
const run = { runKey: 'plan-momentum-20261007-abcdefabcdef', sessionDate: '20261007', createdAt: '', dataSha256: 'd'.repeat(64),
  result: { mode: 'paper', dataSha256: 'd', configuration: {}, order: null,
    evaluations: [signal('000660', 'BUY'), signal('005930', null, '3'), signal('009150', null)].map((s) => ({ signal: s, context, decision: null })) } } as unknown as StrategyRunRecord;
const article = (symbol: string): StoredNews => ({ id: symbol, symbol, provider: 'p', query: 'q', title: '제목', description: '요약',
  link: 'https://x', originalLink: null, publishedAt: '2026-10-06T00:00:00.000Z', collectedAt: '2026-10-06T00:00:00.000Z' });

function setup(caps = { daily: 500000, monthly: 6500000 }, newsFor = ['000660', '005930']) {
  const records: AssessmentRecord[] = [];
  const repository = { find: vi.fn(async (d: string, s: string) => records.find((r) => r.sessionDate === d && r.symbol === s) ?? null),
    save: vi.fn(async (r: AssessmentRecord) => { records.push(r); }), listForSession: vi.fn(async () => records) };
  const assessor: NewsAssessor = { model: 'claude-opus-5-5', worstCaseMicroUsd: () => 60000,
    assess: vi.fn(async () => ({ status: 'assessed' as const, assessment: { verdict: 'clear' as const, categories: [], confidence: 0.9, summary: '이상 없음', evidence: [0] },
      usage: { model: 'claude-opus-5-5', inputTokens: 4600, outputTokens: 170, costMicroUsd: 21800 } })) };
  const news = { save: vi.fn(), recent: vi.fn(), recentForSymbol: vi.fn(async (symbol: string) => newsFor.includes(symbol) ? [article(symbol)] : []) };
  const quota = memoryQuota();
  const screen = createNewsScreener({ assessor, news, quota, caps, repository, plans: { latestPlanRun: async () => run }, now: () => new Date('2026-10-07T00:06:00Z') });
  return { records, repository, assessor, quota, screen };
}

describe('AI news screening', () => {
  it('screens BUY candidates then holdings, reserves worst case and settles the actual cost', async () => {
    const s = setup();
    expect(await s.screen()).toEqual({ targets: 2, assessed: 2, unavailable: 0, noNews: 0, skipped: 0, budgetExhausted: false, costMicroUsd: 43600 });
    expect(s.records.map((r) => [r.symbol, r.status, r.verdict])).toEqual([['000660', 'assessed', 'clear'], ['005930', 'assessed', 'clear']]);
    expect(await s.quota.usage(AI_COST_PROVIDER, '20261007', '202610')).toEqual({ daily: 43600, monthly: 43600 });
    expect(vi.mocked(s.assessor.assess).mock.calls[0]![0]).toMatchObject({ symbol: '000660', name: 'SK하이닉스' });
  });

  it('is free on restart and records symbols without news without calling the model', async () => {
    const s = setup(undefined, ['000660']);
    await s.screen();
    expect(s.records.find((r) => r.symbol === '005930')).toMatchObject({ status: 'no_news', articleCount: 0 });
    expect(await s.screen()).toMatchObject({ assessed: 0, skipped: 2 });
    expect(s.assessor.assess).toHaveBeenCalledTimes(1);
  });

  it('stops before a call that could exceed the budget', async () => {
    const s = setup({ daily: 100000, monthly: 6500000 });
    // First call reserves 60,000 and settles 21,800; the second would need 60,000 more: 81,800 <= 100,000 ok.
    // Third symbol has no news, so exhaustion shows with a tighter cap:
    const tight = setup({ daily: 70000, monthly: 6500000 });
    expect(await tight.screen()).toMatchObject({ assessed: 1, budgetExhausted: true });
    expect(tight.records.at(-1)).toMatchObject({ symbol: '005930', status: 'budget_exhausted' });
    expect((await tight.quota.usage(AI_COST_PROVIDER, '20261007', '202610')).daily).toBeLessThanOrEqual(70000);
    expect((await s.screen())?.budgetExhausted).toBe(false);
  });

  it("does nothing without today's momentum plan", async () => {
    const s = setup();
    const screen = createNewsScreener({ assessor: s.assessor, news: { save: vi.fn(), recent: vi.fn(), recentForSymbol: vi.fn() }, quota: s.quota,
      caps: { daily: 1, monthly: 1 }, repository: s.repository, plans: { latestPlanRun: async () => null } });
    expect(await screen()).toBeNull();
  });
});
