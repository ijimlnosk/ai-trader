import { and, asc, eq, gt } from 'drizzle-orm';
import { calculateTradeLedger, executionDelta, ledgerAmount, type LedgerExecution } from '../../domain/tradeLedger.ts';
import type { createDatabase } from './index.ts';
import { orders, executions } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];
/** A single statement snapshot checks ledger completeness against persisted cumulative order totals. */
export async function readTradeLedger(db: Database, account: string, day: string) {
  const rows = await db.select({ order: orders, execution: executions }).from(orders)
    .leftJoin(executions, eq(executions.orderId, orders.id))
    .where(and(eq(orders.executionAccount, account), gt(orders.filledQuantity, '0')))
    .orderBy(asc(orders.createdAt), asc(orders.id), asc(executions.cumulativeQuantity));
  const events: LedgerExecution[] = [];
  let quantity = '0'; let amount = '0';
  for (let i = 0; i < rows.length; i++) {
    const { order, execution } = rows[i]!;
    if (!execution || execution.executionAccount !== account || execution.symbol !== order.symbol
      || execution.side !== order.side || execution.tradeDate !== order.brokerOrderDate) throw new Error('Incomplete trade ledger');
    const delta = executionDelta(quantity, amount, execution.cumulativeQuantity, execution.cumulativeAmount);
    if (!delta || ledgerAmount(delta.quantity) !== ledgerAmount(execution.quantity)
      || ledgerAmount(delta.amount) !== ledgerAmount(execution.amount)) throw new Error('Inconsistent trade ledger');
    quantity = execution.cumulativeQuantity; amount = execution.cumulativeAmount;
    events.push(execution);
    if (rows[i + 1]?.order.id !== order.id) {
      if (ledgerAmount(quantity) !== ledgerAmount(order.filledQuantity) || ledgerAmount(amount) !== ledgerAmount(order.filledAmount)) {
        throw new Error('Incomplete trade ledger');
      }
      quantity = '0'; amount = '0';
    }
  }
  return calculateTradeLedger(events, day);
}
