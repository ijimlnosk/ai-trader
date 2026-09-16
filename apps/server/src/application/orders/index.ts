import type { OrderResponse, StoredOrder } from '../../domain/orders.ts';
import { createOrderExecution, type ExecutionDependencies } from './execute.ts';
import { createOrderReconciliation } from './reconcile.ts';
import { OrderError } from './ports.ts';

export function orderResponse(order: StoredOrder): OrderResponse {
  const { id, proposalId, symbol, side, quantity, requestedPrice, orderType, riskStatus, riskReasons,
    brokerOrderId, brokerStatus, filledQuantity, filledAmount, positionsSyncedAt, failureCode, createdAt, updatedAt } = order;
  return { id, proposalId, symbol, side, quantity, requestedPrice, orderType, riskStatus, riskReasons,
    brokerOrderId, brokerStatus, filledQuantity, filledAmount, positionsSyncedAt, failureCode, createdAt, updatedAt };
}
export function createOrderServices(deps: ExecutionDependencies) {
  return {
    submit: createOrderExecution(deps),
    reconcile: createOrderReconciliation(deps.repository, deps.broker, deps.account, deps.now),
    async get(id: string) {
      const order = await deps.repository.get(id);
      if (!order) throw new OrderError('order_not_found');
      return order;
    },
  };
}
export type OrderServices = ReturnType<typeof createOrderServices>;
