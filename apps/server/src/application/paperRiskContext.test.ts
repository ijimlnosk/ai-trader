import { expect, it, vi } from 'vitest';
import { createPaperPortfolioRiskContextProvider, PAPER_RISK_V1_INITIAL_STATE } from './paperRiskContext.ts';
import { createRiskEvaluation } from './risk.ts';

const portfolio = { cash: '10000000', totalEvaluation: '10000000', positions: [] };
const proposal = { symbol: '005930', side: 'BUY' as const, quantity: '1', estimatedPrice: '70000', confidence: '0.82' };
function setup(value: unknown) {
  // Simulate potentially malformed external data without coercing it into a Portfolio assertion.
  const getPortfolio = vi.fn().mockResolvedValue(value);
  return { getPortfolio, provider: createPaperPortfolioRiskContextProvider({ getPortfolio }) };
}

it('maps exact portfolio amounts and names the explicit paper v1 initial state', async () => {
  const { provider, getPortfolio } = setup({ ...portfolio, cash: '9007199254740993.12345678' });
  expect(await provider.getRiskContext()).toEqual({
    cash: '9007199254740993.12345678', totalEquity: '10000000', openPositionCount: 0,
    dailyRealizedPnl: '0', consecutiveLosses: 0, killSwitchEnabled: false,
  });
  expect(getPortfolio).toHaveBeenCalledTimes(1);
  expect(Object.isFrozen(PAPER_RISK_V1_INITIAL_STATE)).toBe(true);
});
it.each([0, 1, 3, 5])('counts %s active positions exactly', async (count) => {
  const positions = Array.from({ length: count }, (_, index) => ({ symbol: String(index).padStart(6, '0'), quantity: '1' }));
  const { provider } = setup({ ...portfolio, positions });
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
  const provider = createPaperPortfolioRiskContextProvider({ getPortfolio });
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
