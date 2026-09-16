import type { CreateOrderRequest, StoredOrder, OrderRequest, BrokerFill } from '../../domain/orders.ts';
import type { Portfolio } from '../../domain/portfolio.ts';

export interface OrderBroker {
  getBuyingPower(symbol: string, estimatedPrice: string): Promise<{ cash: string; quantity: string }>;
  submitOrder(request: OrderRequest): Promise<{ accepted: true; brokerOrderId: string } | { accepted: false }>;
  getOrderFill(order: StoredOrder, brokerOrderId: string): Promise<BrokerFill | null>;
}
export type OrderPatch = Partial<Pick<StoredOrder, 'requestedPrice' | 'riskStatus' | 'riskReasons' | 'brokerOrderId'
  | 'brokerOrderDate' | 'brokerStatus' | 'filledQuantity' | 'filledAmount' | 'failureCode' | 'audit' | 'positionsSyncedAt'>>;
/** An explicit successful-HTTP KIS rejection, distinct from an ambiguous submission failure. */
export class BrokerOrderRejected extends Error {
  constructor() { super('Broker rejected paper order'); this.name = 'BrokerOrderRejected'; }
}
export interface OrderRepository {
  /** Atomically replay or reserve a new key; only one unresolved order may exist per account. */
  reserve(key: string, request: CreateOrderRequest): Promise<{ order: StoredOrder; created: boolean }>;
  get(id: string): Promise<StoredOrder | null>;
  update(order: StoredOrder, patch: OrderPatch): Promise<StoredOrder>;
  /** Optimistic update + cumulative fill history + broker position mirror in one transaction. */
  reconcile(order: StoredOrder, patch: OrderPatch, portfolio: Portfolio): Promise<StoredOrder>;
}
export class OrderError extends Error {
  constructor(public readonly code: 'idempotency_conflict' | 'account_busy' | 'order_not_found' | 'order_conflict'
    | 'execution_disabled' | 'reconciliation_required' | 'invalid_reconciliation' | 'order_context_unavailable') {
    super(code);
    this.name = 'OrderError';
  }
}
