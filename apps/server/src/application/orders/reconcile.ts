import { parseRiskDecimal } from '../../domain/risk/index.ts';
import type { AccountBroker } from '../portfolio.ts';
import { createPaperPortfolioRiskContextProvider } from '../paperRiskContext.ts';
import { OrderError, type OrderBroker, type OrderRepository } from './ports.ts';
import { validAmount } from './input.ts';

export function createOrderReconciliation(repository: OrderRepository, broker: OrderBroker, account: AccountBroker, now = () => new Date()) {
  return async (id: string, recoveredBrokerOrderId?: string) => {
    const order = await repository.get(id);
    if (!order) throw new OrderError('order_not_found');
    if (order.positionsSyncedAt && ['FILLED', 'CANCELLED'].includes(order.brokerStatus)) return order;
    if (['PREPARING', 'FAILED', 'RISK_REJECTED', 'BROKER_REJECTED'].includes(order.brokerStatus)) return order;
    const brokerId = order.brokerOrderId ?? recoveredBrokerOrderId;
    if (!brokerId || !order.brokerOrderDate || !order.audit) throw new OrderError('reconciliation_required');
    if (order.brokerOrderId && recoveredBrokerOrderId && order.brokerOrderId !== recoveredBrokerOrderId) throw new OrderError('invalid_reconciliation');
    const fill = await broker.getOrderFill(order, brokerId);
    if (!fill) throw new OrderError('reconciliation_required');
    if (fill.symbol !== order.symbol || fill.side !== order.side || fill.orderDate !== order.brokerOrderDate
      || fill.brokerOrderId !== brokerId || !validAmount(fill.quantity, true)
      || parseRiskDecimal(fill.quantity) !== parseRiskDecimal(order.quantity)
      || !validAmount(fill.filledQuantity) || !validAmount(fill.filledAmount)
      || parseRiskDecimal(fill.filledQuantity)! > parseRiskDecimal(order.quantity)!
      || parseRiskDecimal(fill.filledQuantity)! < parseRiskDecimal(order.filledQuantity)!
      || parseRiskDecimal(fill.filledAmount)! < parseRiskDecimal(order.filledAmount)!) throw new OrderError('invalid_reconciliation');
    const fillQuantity = parseRiskDecimal(fill.filledQuantity)!;
    if ((fill.status === 'FILLED' && fillQuantity !== parseRiskDecimal(order.quantity))
      || (fillQuantity === 0n && parseRiskDecimal(fill.filledAmount) !== 0n)
      || (fillQuantity > 0n && parseRiskDecimal(fill.filledAmount) === 0n)
      || (['SUBMITTED', 'BROKER_REJECTED'].includes(fill.status) && fillQuantity > 0n)
      || (['FILLED', 'CANCELLED'].includes(order.brokerStatus) && fill.status !== order.brokerStatus)) throw new OrderError('invalid_reconciliation');
    const portfolio = await account.getPortfolio();
    if (!await createPaperPortfolioRiskContextProvider({ getPortfolio: async () => portfolio }).getRiskContext()) throw new OrderError('order_context_unavailable');
    const before = parseRiskDecimal(order.audit.positionQuantityBefore)!;
    const filled = parseRiskDecimal(fill.filledQuantity)!;
    const expected = order.side === 'BUY' ? before + filled : before - filled;
    const actual = parseRiskDecimal(portfolio.positions.find((p) => p.symbol === order.symbol)?.quantity ?? '0');
    const terminal = ['FILLED', 'CANCELLED', 'BROKER_REJECTED'].includes(fill.status);
    const positionsSyncedAt = terminal && actual === expected ? now().toISOString() : null;
    // Cumulative snapshots and mirror are atomic and idempotent; never add the same fill twice.
    return repository.reconcile(order, { brokerOrderId: brokerId, brokerStatus: fill.status,
      filledQuantity: fill.filledQuantity, filledAmount: fill.filledAmount, positionsSyncedAt, failureCode: null }, portfolio);
  };
}
