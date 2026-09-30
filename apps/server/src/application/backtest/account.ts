import { calculateTradeLedger, ledgerAmount, ledgerDecimal, type LedgerExecution, type SessionsElapsed } from '../../domain/tradeLedger.ts';
import type { RiskContext } from '../../domain/risk/index.ts';
export interface SimulationAccount { cash: bigint; executions: LedgerExecution[]; marks: Map<string, string> }
export function accountSnapshot(account: SimulationAccount, date: string, killSwitchEnabled: boolean, sessionsElapsed?: SessionsElapsed) {
  const ledger = calculateTradeLedger(account.executions, date, sessionsElapsed);
  let equity = account.cash;
  for (const position of ledger.positions) {
    const mark = account.marks.get(position.symbol);
    if (mark === undefined) throw new Error('Missing valuation price');
    equity += BigInt(position.quantity) * ledgerAmount(mark);
  }
  const context: RiskContext = { cash: ledgerDecimal(account.cash), totalEquity: ledgerDecimal(equity),
    dailyRealizedPnl: ledger.dailyRealizedPnl, consecutiveLosses: ledger.consecutiveLosses,
    openPositionCount: ledger.positions.length, killSwitchEnabled };
  return { ledger, equity, context };
}
