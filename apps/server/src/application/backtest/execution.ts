import { DEFAULT_RISK_POLICY, evaluateRisk, type TradeProposal, type RiskDecision, type RiskContext } from '../../domain/risk/index.ts';
import { ledgerAmount, ledgerDecimal } from '../../domain/tradeLedger.ts';
import { candleTime, type DailyCandle } from '../../domain/strategy/marketData.ts';
import type { StrategyEvaluation } from '../../domain/strategy/evaluate.ts';
import { accountSnapshot, type SimulationAccount } from './account.ts';
export interface SimulationCosts { commissionBps: number; sellTaxBps: number; slippageBps: number }
export function validateCosts(costs: SimulationCosts): void {
  if (![costs.commissionBps, costs.sellTaxBps, costs.slippageBps].every((v) => Number.isSafeInteger(v) && v >= 0 && v < 10000)
    || costs.commissionBps + costs.sellTaxBps >= 10000) throw new Error('Invalid simulation costs');
}
export interface SimulatedExecution {
  signal: StrategyEvaluation; proposal: TradeProposal; context: RiskContext;
  policy: typeof DEFAULT_RISK_POLICY; decision: RiskDecision;
  status: 'FILLED' | 'REJECTED'; reason: string | null;
  grossAmount: string; fees: string; settlementAmount: string; realizedPnl: string | null;
}
const ceilBps = (value: bigint, bps: number) => (value * BigInt(bps) + 9999n) / 10000n;
export function executeSimulation(account: SimulationAccount, signal: StrategyEvaluation, bar: DailyCandle,
  costs: SimulationCosts, killSwitchEnabled: boolean): SimulatedExecution {
  if (!signal.proposal) throw new Error('Missing trade proposal');
  const original = signal.proposal;
  const open = ledgerAmount(bar.open);
  const price = original.side === 'BUY' ? open + ceilBps(open, costs.slippageBps) : open - ceilBps(open, costs.slippageBps);
  const proposal = { ...original, estimatedPrice: ledgerDecimal(price), createdAt: candleTime(bar.date, 'open') };
  const snapshot = accountSnapshot(account, bar.date, killSwitchEnabled);
  const decision = evaluateRisk(proposal, snapshot.context);
  const quantity = BigInt(proposal.quantity);
  const gross = price * quantity;
  const fees = ceilBps(gross, costs.commissionBps) + (proposal.side === 'SELL' ? ceilBps(gross, costs.sellTaxBps) : 0n);
  const settlement = proposal.side === 'BUY' ? gross + fees : gross - fees;
  const position = snapshot.ledger.positions.find((p) => p.symbol === proposal.symbol);
  const reason = !decision.approved ? 'RISK_REJECTED'
    : proposal.side === 'BUY' && settlement > account.cash ? 'INSUFFICIENT_CASH_WITH_COSTS'
      : proposal.side === 'SELL' && (!position || quantity > BigInt(position.quantity)) ? 'INSUFFICIENT_HOLDINGS'
        : settlement <= 0n ? 'INVALID_SETTLEMENT' : null;
  const realized = reason === null && proposal.side === 'SELL' && position
    ? settlement - ledgerAmount(position.costAmount) * quantity / BigInt(position.quantity) : null;
  const result: SimulatedExecution = { signal, proposal, context: snapshot.context, policy: DEFAULT_RISK_POLICY,
    decision, status: reason ? 'REJECTED' : 'FILLED', reason, grossAmount: ledgerDecimal(gross),
    fees: ledgerDecimal(fees), settlementAmount: ledgerDecimal(settlement), realizedPnl: realized === null ? null : ledgerDecimal(realized) };
  if (reason === null) {
    account.cash += proposal.side === 'BUY' ? -settlement : settlement;
    account.executions.push({ orderId: `${signal.version}:${proposal.symbol}:${signal.evaluatedAt}`, symbol: proposal.symbol,
      side: proposal.side, tradeDate: bar.date, quantity: proposal.quantity, amount: ledgerDecimal(settlement) });
  }
  return result;
}
