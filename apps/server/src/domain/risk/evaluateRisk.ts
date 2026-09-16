import { DECIMAL_SCALE } from './decimal.ts';
import { RiskRejection as Reason, type RiskContext, type RiskDecision, type RiskRejectionReason, type TradeProposal } from './models.ts';
import { DEFAULT_RISK_POLICY, type RiskPolicy } from './policy.ts';
import { parseContext, parsePolicy, parseProposal } from './validation.ts';

/** Pure evaluation only. Approval is not an execution authorization or a reservation. */
export function evaluateRisk(
  proposal: TradeProposal, context: RiskContext, policy: Readonly<RiskPolicy> = DEFAULT_RISK_POLICY,
): RiskDecision {
  const reasons: RiskRejectionReason[] = [];
  const trade = parseProposal(proposal);
  const account = parseContext(context);
  const limits = parsePolicy(policy);
  if (!trade) reasons.push(Reason.INVALID_PROPOSAL);
  if (!account) reasons.push(Reason.INVALID_CONTEXT);
  if (!limits) reasons.push(Reason.INVALID_POLICY);
  if (proposal.side === 'BUY') {
    if (context.killSwitchEnabled === true) reasons.push(Reason.KILL_SWITCH_ENABLED);
    // Collect independent reasons even if another part of the input is invalid.
    if (trade && limits && trade.confidence < limits.confidence) reasons.push(Reason.CONFIDENCE_TOO_LOW);
    if (trade && account) {
      const notional = trade.price * trade.quantity; // scale squared; never truncate products
      if (notional > account.cash * DECIMAL_SCALE) reasons.push(Reason.INSUFFICIENT_CASH);
      if (limits && notional > account.equity * limits.exposure) reasons.push(Reason.MAX_POSITION_EXPOSURE_EXCEEDED);
    }
    if (account && limits) {
      // Conservative v1: treats every BUY as a new position, including additional purchases.
      if (context.openPositionCount >= policy.maxOpenPositions) reasons.push(Reason.MAX_PORTFOLIO_POSITIONS_EXCEEDED);
      if (account.pnl * DECIMAL_SCALE <= -(account.equity * limits.loss)) reasons.push(Reason.DAILY_LOSS_LIMIT_EXCEEDED);
      if (context.consecutiveLosses >= policy.maxConsecutiveLosses) reasons.push(Reason.CONSECUTIVE_LOSS_LIMIT_EXCEEDED);
    }
  }
  return reasons.length > 0
    ? { approved: false, approvedQuantity: '0', reasons }
    : { approved: true, approvedQuantity: proposal.quantity, reasons: [] };
}
