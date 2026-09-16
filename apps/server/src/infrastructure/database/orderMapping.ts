import type { StoredOrder } from '../../domain/orders.ts';
import type { orders } from './schema.ts';

export function mapStoredOrder(row: typeof orders.$inferSelect): StoredOrder {
  if (!row.requestPayload || !row.idempotencyKey || !row.brokerStatus || row.orderType !== 'MARKET') {
    throw new Error('Unsupported legacy order');
  }
  return {
    id: row.id, proposalId: row.proposalId, symbol: row.symbol, side: row.side,
    quantity: row.requestPayload.quantity, requestedPrice: row.requestedPrice, orderType: 'MARKET',
    riskStatus: row.riskStatus, riskReasons: row.riskReasons, brokerOrderId: row.brokerOrderId,
    brokerStatus: row.brokerStatus, filledQuantity: row.filledQuantity, filledAmount: row.filledAmount,
    positionsSyncedAt: row.positionsSyncedAt?.toISOString() ?? null, failureCode: row.failureCode,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    request: row.requestPayload, idempotencyKey: row.idempotencyKey, version: row.version,
    audit: row.riskAudit, brokerOrderDate: row.brokerOrderDate,
  };
}
