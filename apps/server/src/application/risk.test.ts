import { expect, it, vi } from 'vitest';
import { createRiskEvaluation } from './risk.ts';
import { DEFAULT_RISK_POLICY, type RiskContext } from '../domain/risk/index.ts';

const input = { symbol: '005930', side: 'BUY' as const, quantity: '10', estimatedPrice: '70000', confidence: '0.82' };
const context: RiskContext = { cash: '1000000', totalEquity: '7000000', dailyRealizedPnl: '0', openPositionCount: 0, consecutiveLosses: 0, killSwitchEnabled: false };
it('captures reproducible proposal, policy, context, decision and timestamp snapshots', async () => {
  const provider = { getRiskContext: vi.fn(async () => context) };
  const policy = { ...DEFAULT_RISK_POLICY };
  const now = () => new Date('2026-09-16T00:00:00.000Z');
  const evaluate = createRiskEvaluation(provider, policy, now);
  policy.minConfidence = '1';
  const result = await evaluate(input);
  expect(result).toEqual({ proposal: { ...input, createdAt: now().toISOString() }, policy: DEFAULT_RISK_POLICY,
    context, decision: { approved: true, approvedQuantity: '10', reasons: [] }, evaluatedAt: now().toISOString() });
  expect(result.context).not.toBe(context);
  expect(provider.getRiskContext).toHaveBeenCalledTimes(1);
});
it('missing trusted context cannot approve a trade', async () => {
  const result = await createRiskEvaluation({ getRiskContext: async () => null })(input);
  expect(result.decision).toEqual({ approved: false, approvedQuantity: '0', reasons: ['INVALID_CONTEXT'] });
});
it('context provider failure propagates without approving', async () => {
  const evaluate = createRiskEvaluation({ getRiskContext: async () => { throw new Error('unavailable'); } });
  await expect(evaluate(input)).rejects.toThrow('unavailable');
});
