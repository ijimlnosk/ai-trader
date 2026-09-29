import { orderResponse, type OrderServices } from '../orders/index.ts';
import type { StoredOrder } from '../../domain/orders.ts';
import type { PaperLoopRepository, PaperLoopRun } from './ports.ts';

export function terminalLoopOrder(order: StoredOrder): boolean {
  return ['FAILED', 'RISK_REJECTED', 'BROKER_REJECTED'].includes(order.brokerStatus)
    || (['FILLED', 'CANCELLED'].includes(order.brokerStatus) && order.positionsSyncedAt !== null);
}
/** Never submits, guesses broker IDs, or automatically resolves ambiguous transport states. */
export async function recoverLoop(run: PaperLoopRun, repo: PaperLoopRepository,
  orders: OrderServices, now: () => Date): Promise<PaperLoopRun> {
  if (run.status === 'COMPLETE') return run;
  let order = await repo.findOrder(run.orderKey);
  // A crash before reservation cannot be distinguished from an active claimant. Never reclaim.
  if (!order) return run;
  if (order.symbol !== '005930' || order.request.strategy?.dataSha256 !== run.input.dataSha256) {
    return repo.update(run, { result: run.result, order: null, status: 'HALTED', reason: 'order_identity_conflict' });
  }
  let reason: string | null = null;
  if (!terminalLoopOrder(order)) {
    if (['PREPARING', 'SUBMITTING', 'UNKNOWN'].includes(order.brokerStatus) || !order.brokerOrderId) {
      reason = 'operator_reconciliation_required';
    } else if (now().getTime() >= Date.parse(run.deadline)) {
      reason = 'reconciliation_deadline';
    } else {
      try { order = await orders.reconcile(order.id); }
      catch { reason = 'reconciliation_unavailable'; }
    }
  }
  return repo.update(run, { result: run.result, order: orderResponse(order), reason,
    status: terminalLoopOrder(order) ? 'COMPLETE' : reason === 'operator_reconciliation_required'
      || reason === 'reconciliation_deadline' ? 'HALTED' : 'TRACKING' });
}
