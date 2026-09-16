import { DECIMAL_SCALE, parseRiskDecimal } from './decimal.ts';
import type { RiskContext, TradeProposal } from './models.ts';
import type { RiskPolicy } from './policy.ts';

const count = (value: number) => Number.isSafeInteger(value) && value >= 0;
const ratio = (value: bigint | null): value is bigint => value !== null && value >= 0n && value <= DECIMAL_SCALE;

export function parseProposal(proposal: TradeProposal) {
  const quantity = parseRiskDecimal(proposal.quantity);
  const price = parseRiskDecimal(proposal.estimatedPrice);
  const confidence = parseRiskDecimal(proposal.confidence);
  const timestamp = proposal.createdAt;
  if (typeof proposal.symbol !== 'string' || !/^\d{6}$/.test(proposal.symbol) || proposal.symbol.length !== 6
    || (proposal.side !== 'BUY' && proposal.side !== 'SELL')
    || quantity === null || quantity <= 0n || price === null || price <= 0n || !ratio(confidence)
    || typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp)
    || !Number.isFinite(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) return null;
  return { quantity, price, confidence };
}

export function parseContext(context: RiskContext) {
  const cash = parseRiskDecimal(context.cash);
  const equity = parseRiskDecimal(context.totalEquity);
  const pnl = parseRiskDecimal(context.dailyRealizedPnl);
  if (cash === null || cash < 0n || equity === null || equity <= 0n || pnl === null
    || !count(context.openPositionCount) || !count(context.consecutiveLosses)
    || typeof context.killSwitchEnabled !== 'boolean') return null;
  return { cash, equity, pnl };
}

export function parsePolicy(policy: Readonly<RiskPolicy>) {
  const confidence = parseRiskDecimal(policy.minConfidence);
  const exposure = parseRiskDecimal(policy.maxPositionExposureRate);
  const loss = parseRiskDecimal(policy.maxDailyLossRate);
  if (typeof policy.version !== 'string' || !policy.version.trim() || !ratio(confidence)
    || !ratio(exposure) || exposure === 0n || !ratio(loss) || loss === 0n
    || !count(policy.maxOpenPositions) || policy.maxOpenPositions === 0
    || !count(policy.maxConsecutiveLosses) || policy.maxConsecutiveLosses === 0) return null;
  return { confidence, exposure, loss };
}
