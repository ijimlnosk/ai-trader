import { and, eq, notInArray, sql } from 'drizzle-orm';
import { OrderError, type OrderPatch, type OrderRepository } from '../../application/orders/ports.ts';
import { sameOrderInput } from '../../application/orders/input.ts';
import type { StoredOrder } from '../../domain/orders.ts';
import type { createDatabase } from './index.ts';
import { orders, tradeProposals, positions, orderFills } from './schema.ts';
import { mapStoredOrder } from './orderMapping.ts';

type Database = ReturnType<typeof createDatabase>['db'];
export function createOrderRepository(db: Database, executionAccount: string): OrderRepository {
  const scope = eq(orders.executionAccount, executionAccount);
  const byKey = async (key: string) => (await db.select().from(orders).where(and(scope, eq(orders.idempotencyKey, key))))[0];
  const patchValues = (order: StoredOrder, { audit, ...patch }: OrderPatch) => ({
    ...patch, riskAudit: audit, price: patch.requestedPrice,
    positionsSyncedAt: patch.positionsSyncedAt === undefined ? undefined : patch.positionsSyncedAt === null ? null : new Date(patch.positionsSyncedAt),
    updatedAt: new Date(), version: order.version + 1,
    status: patch.brokerStatus === 'FILLED' ? 'filled' as const : patch.brokerStatus === 'CANCELLED' ? 'cancelled' as const
      : ['RISK_REJECTED', 'BROKER_REJECTED', 'FAILED'].includes(patch.brokerStatus ?? '') ? 'rejected' as const
        : ['SUBMITTED', 'PARTIALLY_FILLED'].includes(patch.brokerStatus ?? '') ? 'submitted' as const : undefined,
  });
  const match = (order: StoredOrder) => and(scope, eq(orders.id, order.id), eq(orders.version, order.version));
  return {
    async reserve(key, request) {
      const replay = (row: typeof orders.$inferSelect) => {
        if (!sameOrderInput(row.requestPayload, request)) throw new OrderError('idempotency_conflict');
        return { order: mapStoredOrder(row), created: false };
      };
      const existing = await byKey(key);
      if (existing) return replay(existing);
      try {
        return await db.transaction(async (tx) => {
          const [proposal] = await tx.insert(tradeProposals).values({ symbol: request.symbol, side: request.side,
            score: '0', confidence: request.confidence, reason: 'human_api', risk: 'pending' }).returning();
          if (!proposal) throw new Error('Proposal persistence failed');
          const [row] = await tx.insert(orders).values({ proposalId: proposal.id, symbol: request.symbol,
            side: request.side, quantity: request.quantity, currency: 'KRW', executionAccount,
            idempotencyKey: key, requestPayload: request, orderType: request.orderType, brokerStatus: 'PREPARING',
          }).onConflictDoNothing().returning();
          if (!row) throw new OrderError('account_busy');
          return { order: mapStoredOrder(row), created: true };
        });
      } catch (error) {
        if (error instanceof OrderError && error.code === 'account_busy') {
          const raced = await byKey(key);
          if (raced) return replay(raced);
        }
        throw error;
      }
    },
    async get(id) {
      const [row] = await db.select().from(orders).where(and(scope, eq(orders.id, id)));
      return row ? mapStoredOrder(row) : null;
    },
    async update(order, patch) {
      return db.transaction(async (tx) => {
        const [row] = await tx.update(orders).set(patchValues(order, patch)).where(match(order)).returning();
        if (!row) throw new OrderError('order_conflict');
        if (patch.riskStatus) await tx.update(tradeProposals).set({ status: patch.riskStatus,
          risk: JSON.stringify(patch.riskReasons ?? []) }).where(eq(tradeProposals.id, order.proposalId));
        return mapStoredOrder(row);
      });
    },
    async reconcile(order, patch, portfolio) {
      return db.transaction(async (tx) => {
        const [row] = await tx.update(orders).set(patchValues(order, patch)).where(match(order)).returning();
        if (!row) throw new OrderError('order_conflict');
        await tx.insert(orderFills).values({ orderId: order.id, filledQuantity: row.filledQuantity,
          filledAmount: row.filledAmount, brokerStatus: row.brokerStatus! }).onConflictDoNothing();
        const timestamp = new Date();
        const symbols = portfolio.positions.map((p) => p.symbol);
        await tx.update(positions).set({ quantity: '0', unrealizedPnl: '0', closedAt: timestamp, syncedAt: timestamp })
          .where(and(eq(positions.executionAccount, executionAccount), symbols.length ? notInArray(positions.symbol, symbols) : sql`true`));
        for (const p of portfolio.positions) {
          await tx.insert(positions).values({ executionAccount, symbol: p.symbol, quantity: p.quantity,
            averagePrice: p.averagePrice, currency: 'KRW', unrealizedPnl: p.profitLoss, syncedAt: timestamp,
          }).onConflictDoUpdate({ target: [positions.executionAccount, positions.symbol],
            set: { quantity: p.quantity, averagePrice: p.averagePrice, unrealizedPnl: p.profitLoss, closedAt: null, syncedAt: timestamp } });
        }
        return mapStoredOrder(row);
      });
    },
  };
}
