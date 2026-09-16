import { expect, it } from 'vitest';
import { DEFAULT_RISK_POLICY, evaluateRisk, RiskRejection as R, type RiskContext, type TradeProposal } from './index.ts';

const proposal: TradeProposal = { symbol: '005930', side: 'BUY', quantity: '10', estimatedPrice: '10', confidence: '0.70', createdAt: '2026-09-16T00:00:00.000Z' };
const context: RiskContext = { cash: '1000', totalEquity: '1000', dailyRealizedPnl: '0', openPositionCount: 4, consecutiveLosses: 2, killSwitchEnabled: false };
it.each([
  ['0.69', false], ['0.70', true], ['0.71', true],
])('confidence %s approves %s', (confidence, approved) => {
  const result = evaluateRisk({ ...proposal, confidence }, context);
  expect(result.approved).toBe(approved);
  expect(result.reasons).toEqual(approved ? [] : [R.CONFIDENCE_TOO_LOW]);
});
it.each([['9.99999999', true], ['10', true], ['10.00000001', false]])('exposure price %s approves %s', (estimatedPrice, approved) => {
  expect(evaluateRisk({ ...proposal, estimatedPrice }, context)).toEqual(approved
    ? { approved, approvedQuantity: '10', reasons: [] }
    : { approved, approvedQuantity: '0', reasons: [R.MAX_POSITION_EXPOSURE_EXCEEDED] });
});
it.each([['100.00000001', true], ['100', true], ['99.99999999', false]])('cash %s approves %s', (cash, approved) => {
  expect(evaluateRisk(proposal, { ...context, cash }).reasons).toEqual(approved ? [] : [R.INSUFFICIENT_CASH]);
});
it.each([[4, true], [5, false], [6, false]])('positions %s approves %s', (openPositionCount, approved) => {
  expect(evaluateRisk(proposal, { ...context, openPositionCount }).reasons).toEqual(approved ? [] : [R.MAX_PORTFOLIO_POSITIONS_EXCEEDED]);
});
it.each([['-19.9', true], ['-20.00', false], ['-20.1', false]])('daily P/L %s approves %s', (dailyRealizedPnl, approved) => {
  expect(evaluateRisk(proposal, { ...context, dailyRealizedPnl }).reasons).toEqual(approved ? [] : [R.DAILY_LOSS_LIMIT_EXCEEDED]);
});
it.each([[2, true], [3, false], [4, false]])('loss streak %s approves %s', (consecutiveLosses, approved) => {
  expect(evaluateRisk(proposal, { ...context, consecutiveLosses }).reasons).toEqual(approved ? [] : [R.CONSECUTIVE_LOSS_LIMIT_EXCEEDED]);
});
it.each([false, true])('kill switch %s', (killSwitchEnabled) => {
  expect(evaluateRisk(proposal, { ...context, killSwitchEnabled }).reasons).toEqual(killSwitchEnabled ? [R.KILL_SWITCH_ENABLED] : []);
});
it.each<Partial<TradeProposal>>([
  { quantity: '0' }, { quantity: '-1' }, { estimatedPrice: '0' }, { estimatedPrice: '-1' },
  { quantity: 'NaN' }, { quantity: '1e2' }, { quantity: '0.000000001' }, { quantity: '10000000000000000' },
  { quantity: '1\n' }, { quantity: ' 1' }, { confidence: 'NaN' }, { confidence: '-0.01' },
  { confidence: '1.01' }, { confidence: '' }, { symbol: 'AAPL' }, { symbol: '005930\n' },
  { symbol: '１２３４５６' }, { createdAt: 'invalid' }, { createdAt: '2026-02-30T00:00:00.000Z' },
])('rejects invalid proposal %j', (patch) => {
  expect(evaluateRisk({ ...proposal, ...patch }, context).reasons).toContain(R.INVALID_PROPOSAL);
});
it.each<Partial<RiskContext>>([
  { cash: '-1' }, { cash: 'NaN' }, { totalEquity: '0' }, { totalEquity: '-1' },
  { dailyRealizedPnl: 'NaN' }, { openPositionCount: -1 }, { openPositionCount: 1.5 },
  { consecutiveLosses: NaN }, { consecutiveLosses: Number.MAX_SAFE_INTEGER + 1 },
])('fails closed on invalid context %j', (patch) => {
  expect(evaluateRisk(proposal, { ...context, ...patch }).reasons).toContain(R.INVALID_CONTEXT);
});
it.each([
  { minConfidence: 'NaN' }, { minConfidence: '1.1' }, { maxPositionExposureRate: '0' },
  { maxPositionExposureRate: '1.1' }, { maxDailyLossRate: '-1' }, { maxDailyLossRate: '0' },
  { maxOpenPositions: 0 }, { maxOpenPositions: 1.5 }, { maxConsecutiveLosses: -1 }, { version: '' },
])('fails closed on invalid policy %j', (patch) => {
  expect(evaluateRisk(proposal, context, { ...DEFAULT_RISK_POLICY, ...patch }).reasons).toContain(R.INVALID_POLICY);
});
it('collects all seven BUY failures in stable order, even with kill switch', () => {
  expect(evaluateRisk({ ...proposal, confidence: '0.69', quantity: '11' }, {
    ...context, cash: '0', killSwitchEnabled: true, openPositionCount: 5, dailyRealizedPnl: '-20', consecutiveLosses: 3,
  })).toEqual({ approved: false, approvedQuantity: '0', reasons: [R.KILL_SWITCH_ENABLED, R.CONFIDENCE_TOO_LOW,
    R.INSUFFICIENT_CASH, R.MAX_POSITION_EXPOSURE_EXCEEDED, R.MAX_PORTFOLIO_POSITIONS_EXCEEDED,
    R.DAILY_LOSS_LIMIT_EXCEEDED, R.CONSECUTIVE_LOSS_LIMIT_EXCEEDED] });
});
it('SELL skips BUY controls, but still validates inputs', () => {
  const sell = { ...proposal, side: 'SELL' as const, confidence: '0', quantity: '1000' };
  const blocked = { ...context, cash: '0', killSwitchEnabled: true, openPositionCount: 6, consecutiveLosses: 4, dailyRealizedPnl: '-100' };
  expect(evaluateRisk(sell, blocked)).toEqual({ approved: true, approvedQuantity: '1000', reasons: [] });
  expect(evaluateRisk({ ...sell, quantity: '0' }, blocked).reasons).toEqual([R.INVALID_PROPOSAL]);
});
it('preserves sub-eight-place product precision without rounding', () => {
  const trade = { ...proposal, quantity: '0.00000001', estimatedPrice: '0.00000001' };
  expect(evaluateRisk(trade, { ...context, cash: '0' }).reasons).toEqual([R.INSUFFICIENT_CASH]);
});
it('handles values beyond safe JS integer precision exactly', () => {
  const account = { ...context, totalEquity: '9007199254740993', cash: '9007199254740993' };
  expect(evaluateRisk({ ...proposal, quantity: '1', estimatedPrice: '900719925474099.3' }, account).approved).toBe(true);
  expect(evaluateRisk({ ...proposal, quantity: '1', estimatedPrice: '900719925474099.30000001' }, account).reasons).toEqual([R.MAX_POSITION_EXPOSURE_EXCEEDED]);
});
it('is repeatable and leaves frozen inputs untouched', () => {
  const a = Object.freeze({ ...proposal }); const b = Object.freeze({ ...context });
  expect(evaluateRisk(a, b)).toEqual(evaluateRisk(a, b));
  expect(Object.isFrozen(DEFAULT_RISK_POLICY)).toBe(true);
});
it('uses the supplied versioned policy without changing proposals to fit limits', () => {
  const policy = { ...DEFAULT_RISK_POLICY, version: 'strict-test', minConfidence: '0.80',
    maxPositionExposureRate: '0.09', maxOpenPositions: 4, maxDailyLossRate: '0.01', maxConsecutiveLosses: 2 };
  expect(evaluateRisk(proposal, { ...context, dailyRealizedPnl: '-10' }, policy).reasons).toEqual([
    R.CONFIDENCE_TOO_LOW, R.MAX_POSITION_EXPOSURE_EXCEEDED, R.MAX_PORTFOLIO_POSITIONS_EXCEEDED,
    R.DAILY_LOSS_LIMIT_EXCEEDED, R.CONSECUTIVE_LOSS_LIMIT_EXCEEDED,
  ]);
});
it('does not truncate a fractional daily-loss threshold', () => {
  const trade = { ...proposal, quantity: '1', estimatedPrice: '1' };
  const account = { ...context, totalEquity: '1000.00000001', dailyRealizedPnl: '-20' };
  expect(evaluateRisk(trade, account).approved).toBe(true);
  expect(evaluateRisk(trade, { ...account, dailyRealizedPnl: '-20.00000001' }).reasons).toEqual([R.DAILY_LOSS_LIMIT_EXCEEDED]);
});
it('SELL cannot bypass invalid context or policy validation', () => {
  const trade = { ...proposal, side: 'SELL' as const };
  expect(evaluateRisk(trade, { ...context, totalEquity: 'NaN' }).reasons).toEqual([R.INVALID_CONTEXT]);
  expect(evaluateRisk(trade, context, { ...DEFAULT_RISK_POLICY, minConfidence: '-1' }).reasons).toEqual([R.INVALID_POLICY]);
});
it.each([['0', false], ['1', true]])('accepts valid confidence endpoint %s', (confidence, approved) => {
  const decision = evaluateRisk({ ...proposal, confidence }, context);
  expect(decision.approved).toBe(approved);
  expect(decision.reasons).not.toContain(R.INVALID_PROPOSAL);
});
