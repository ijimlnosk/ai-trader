import { expect, it, vi } from 'vitest';
import { createPaperPortfolioRiskContextProvider } from './paperRiskContext.ts';
import { createRiskEvaluation } from './risk.ts';

const portfolio = { cash: '10000000', totalEvaluation: '10000000', positions: [] };
const proposal = { symbol: '005930', side: 'BUY' as const, quantity: '1', estimatedPrice: '70000', confidence: '0.82' };
function setup(value: unknown, positions: { symbol: string; quantity: string; costAmount: string }[] = []) {
  // Simulate potentially malformed external data without coercing it into a Portfolio assertion.
  const getPortfolio = vi.fn().mockResolvedValue(value);
  return { getPortfolio, provider: createPaperPortfolioRiskContextProvider({ getPortfolio }, { getTradeLedger: async () => ({ dailyRealizedPnl: '0', consecutiveLosses: 0, positions }) }) };
}

it('maps exact portfolio amounts with explicitly supplied ledger history', async () => {
  const { provider, getPortfolio } = setup({ ...portfolio, cash: '9007199254740993.12345678' });
  expect(await provider.getRiskContext()).toEqual({
    cash: '9007199254740993.12345678', totalEquity: '10000000', openPositionCount: 0,
    dailyRealizedPnl: '0', consecutiveLosses: 0, killSwitchEnabled: false,
  });
  expect(getPortfolio).toHaveBeenCalledTimes(1);
});
it.each([0, 1, 3, 5])('counts %s active positions exactly', async (count) => {
  const positions = Array.from({ length: count }, (_, index) => ({ symbol: String(index).padStart(6, '0'), quantity: '1' }));
  const { provider } = setup({ ...portfolio, positions }, positions.map((p) => ({ ...p, costAmount: '70000' })));
  expect((await provider.getRiskContext())?.openPositionCount).toBe(count);
});
it('zero cash is a valid context but rejects BUY as insufficient cash', async () => {
  const { provider } = setup({ ...portfolio, cash: '0' });
  expect((await createRiskEvaluation(provider)(proposal)).decision.reasons).toEqual(['INSUFFICIENT_CASH']);
});
it.each([
  null, undefined, [], {},
  { ...portfolio, cash: 'NaN' }, { ...portfolio, cash: '-1' }, { ...portfolio, cash: 10000000 },
  { ...portfolio, cash: '1e7' }, { ...portfolio, cash: '0.000000001' },
  { ...portfolio, totalEvaluation: 'NaN' }, { ...portfolio, totalEvaluation: '0' },
  { ...portfolio, totalEvaluation: '-1' }, { ...portfolio, totalEvaluation: 10000000 },
  { ...portfolio, positions: null }, { ...portfolio, positions: undefined },
  { ...portfolio, positions: { length: 0 } }, { ...portfolio, positions: [null] },
  { ...portfolio, positions: [{}] }, { ...portfolio, positions: [{ symbol: '005930', quantity: '0' }] },
  { ...portfolio, positions: [{ symbol: '005930', quantity: '-1' }] },
  { ...portfolio, positions: [{ symbol: '005930', quantity: 'NaN' }] },
  { ...portfolio, positions: [{ symbol: 'invalid', quantity: '1' }] },
  { ...portfolio, positions: [{ symbol: '005930', quantity: '1' }, { symbol: '005930', quantity: '2' }] },
])('rejects malformed portfolio without approving %j', async (value) => {
  const { provider } = setup(value);
  expect((await createRiskEvaluation(provider)(proposal)).decision).toEqual({
    approved: false, approvedQuantity: '0', reasons: ['INVALID_CONTEXT'],
  });
});
it('propagates broker failure and never substitutes the paper initial state for missing account data', async () => {
  const getPortfolio = vi.fn().mockRejectedValue(new Error('portfolio unavailable'));
  const provider = createPaperPortfolioRiskContextProvider({ getPortfolio }, undefined);
  await expect(createRiskEvaluation(provider)(proposal)).rejects.toThrow('portfolio unavailable');
});
it('reads fresh portfolio data on every evaluation and does not reuse a last-good context after failure', async () => {
  const { provider, getPortfolio } = setup(portfolio);
  const evaluate = createRiskEvaluation(provider);
  expect((await evaluate(proposal)).decision.approved).toBe(true);
  getPortfolio.mockResolvedValueOnce(null);
  expect((await evaluate(proposal)).decision.reasons).toEqual(['INVALID_CONTEXT']);
  expect(getPortfolio).toHaveBeenCalledTimes(2);
});

it('uses ledger daily loss and streak with the real configured kill switch', async () => {
  const ledger = { getTradeLedger: vi.fn(async () => ({ dailyRealizedPnl: '-200000', consecutiveLosses: 3, positions: [] })) };
  const provider = createPaperPortfolioRiskContextProvider({ getPortfolio: vi.fn().mockResolvedValue(portfolio) }, ledger, true,
    () => new Date('2026-09-16T15:00:00.000Z'));
  const result = await createRiskEvaluation(provider)(proposal);
  expect(result.context).toMatchObject({ dailyRealizedPnl: '-200000', consecutiveLosses: 3, killSwitchEnabled: true });
  expect(result.decision.approved).toBe(false);
  expect(result.decision.reasons).toEqual(expect.arrayContaining(['DAILY_LOSS_LIMIT_EXCEEDED', 'CONSECUTIVE_LOSS_LIMIT_EXCEEDED', 'KILL_SWITCH_ENABLED']));
  expect(ledger.getTradeLedger).toHaveBeenCalledWith('20260917');
});
it('missing ledger, untracked holdings, and absent broker holdings all fail closed', async () => {
  expect(await createPaperPortfolioRiskContextProvider({ getPortfolio: vi.fn().mockResolvedValue(portfolio) }, undefined).getRiskContext()).toBeNull();
  expect(await setup({ ...portfolio, positions: [{ symbol: '005930', quantity: '1' }] }).provider.getRiskContext()).toBeNull();
  expect(await setup(portfolio, [{ symbol: '005930', quantity: '1', costAmount: '70000' }]).provider.getRiskContext()).toBeNull();
});
it('ledger failures propagate without returning a fabricated zero or cached context', async () => {
  const ledger = { getTradeLedger: vi.fn().mockRejectedValue(new Error('ledger unavailable')) };
  const provider = createPaperPortfolioRiskContextProvider({ getPortfolio: vi.fn().mockResolvedValue(portfolio) }, ledger);
  await expect(provider.getRiskContext()).rejects.toThrow('ledger unavailable');
});
