import { DECIMAL_SCALE } from '../risk/decimal.ts';
import { evaluateRisk, type RiskContext, type RiskDecision } from '../risk/index.ts';
import { DEFAULT_RISK_POLICY, type RiskPolicy } from '../risk/policy.ts';
import { ledgerAmount } from '../tradeLedger.ts';
import type { StrategyEvaluation } from './evaluate.ts';

export interface PlanItem {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  estimatedPrice: string;
  reason: string;
  /** 1-based execution order; SELLs first, then BUYs by rank. */
  rank: number;
  decision: RiskDecision;
  /** Context the decision was made with, after earlier approved items in this plan. */
  context: RiskContext;
}
export interface SessionPlan { items: PlanItem[]; scanned: number; reasons: Record<string, number> }

const formatScaled = (value: bigint) => {
  const whole = value / DECIMAL_SCALE; const fraction = (value % DECIMAL_SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
};

/** Stronger volume confirmation first, then wider EMA spread, then symbol for determinism. */
function buyOrder(a: StrategyEvaluation, b: StrategyEvaluation): number {
  const va = a.indicators?.volumeRatio ?? 0; const vb = b.indicators?.volumeRatio ?? 0;
  if (va !== vb) return vb - va;
  const sa = a.indicators ? (a.indicators.ema20 - a.indicators.ema60) / a.indicators.ema60 : 0;
  const sb = b.indicators ? (b.indicators.ema20 - b.indicators.ema60) / b.indicators.ema60 : 0;
  if (sa !== sb) return sb - sa;
  return a.symbol < b.symbol ? -1 : 1;
}

/**
 * Orders a session's proposals and re-evaluates risk sequentially, as if each earlier approved
 * item had executed: BUYs consume cash and a position slot; SELL proceeds are not treated as cash
 * (settlement). Pure and order-free; execution re-checks everything with fresh account data.
 */
export function planSession(evaluations: readonly StrategyEvaluation[], context: RiskContext,
  policy: Readonly<RiskPolicy> = DEFAULT_RISK_POLICY): SessionPlan {
  const reasons: Record<string, number> = {};
  for (const evaluation of evaluations) reasons[evaluation.reason] = (reasons[evaluation.reason] ?? 0) + 1;
  const withProposal = evaluations.filter((evaluation) => evaluation.proposal);
  const ordered = [...withProposal.filter((e) => e.proposal!.side === 'SELL').sort((a, b) => (a.symbol < b.symbol ? -1 : 1)),
    ...withProposal.filter((e) => e.proposal!.side === 'BUY').sort(buyOrder)];
  let current: RiskContext = { ...context };
  const items = ordered.map((evaluation, index): PlanItem => {
    const proposal = evaluation.proposal!;
    const decision = evaluateRisk(proposal, current, policy);
    const item: PlanItem = { symbol: evaluation.symbol, side: proposal.side, quantity: proposal.quantity,
      estimatedPrice: proposal.estimatedPrice, reason: evaluation.reason, rank: index + 1, decision, context: current };
    if (decision.approved && proposal.side === 'BUY') {
      const notional = ledgerAmount(proposal.estimatedPrice) * BigInt(decision.approvedQuantity);
      current = { ...current, cash: formatScaled(ledgerAmount(current.cash) - notional), openPositionCount: current.openPositionCount + 1 };
    } else if (decision.approved) {
      current = { ...current, openPositionCount: Math.max(0, current.openPositionCount - 1) };
    }
    return item;
  });
  return { items, scanned: evaluations.length, reasons };
}
