import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { CreateOrderRequest, ExecutionStatus } from '@ai-trader/contracts';
import type { OrderAudit } from '../../domain/orders.ts';

export const proposalSide = pgEnum('proposal_side', ['BUY', 'SELL', 'HOLD']);
export const orderSide = pgEnum('order_side', ['BUY', 'SELL']);
export const proposalStatus = pgEnum('proposal_status', ['pending', 'approved', 'rejected']);
export const orderStatus = pgEnum('order_status', ['pending', 'submitted', 'filled', 'cancelled', 'rejected']);
// Monetary values are decimal strings in Drizzle; no Number conversion or arithmetic.
const money = (name: string) => numeric(name, { precision: 24, scale: 8 });
const quantity = (name: string) => numeric(name, { precision: 24, scale: 8 });
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const tradeProposals = pgTable('trade_proposals', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull(),
  side: proposalSide('side').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  status: proposalStatus('status').notNull().default('pending'),
  reason: text('reason').notNull(),
  risk: text('risk').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [
  check('proposal_score_range', sql`${t.score} BETWEEN 0 AND 100`),
  check('proposal_confidence_range', sql`${t.confidence} BETWEEN 0 AND 1`),
]);

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  proposalId: uuid('proposal_id').notNull().references(() => tradeProposals.id, { onDelete: 'restrict' }),
  symbol: text('symbol').notNull(),
  side: orderSide('side').notNull(),
  quantity: quantity('quantity').notNull(),
  price: money('price'), // Nullable until a server quote exists; old rows retain their values.
  currency: text('currency').notNull(),
  status: orderStatus('status').notNull().default('pending'),
  brokerOrderId: text('broker_order_id'),
  executionAccount: text('execution_account'),
  idempotencyKey: text('idempotency_key'),
  requestPayload: jsonb('request_payload').$type<CreateOrderRequest>(),
  requestedPrice: money('requested_price'),
  orderType: text('order_type'),
  riskStatus: proposalStatus('risk_status').notNull().default('pending'),
  riskReasons: jsonb('risk_reasons').$type<string[]>().notNull().default([]),
  riskAudit: jsonb('risk_audit').$type<OrderAudit>(),
  brokerStatus: text('broker_status').$type<ExecutionStatus>(),
  brokerOrderDate: text('broker_order_date'),
  filledQuantity: quantity('filled_quantity').notNull().default('0'),
  filledAmount: money('filled_amount').notNull().default('0'),
  positionsSyncedAt: instant('positions_synced_at'),
  failureCode: text('failure_code'),
  version: integer('version').notNull().default(0),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (t) => [
  index('orders_proposal_id_idx').on(t.proposalId),
  uniqueIndex('orders_execution_key_idx').on(t.executionAccount, t.idempotencyKey),
  uniqueIndex('orders_broker_identity_idx').on(t.executionAccount, t.brokerOrderDate, t.brokerOrderId),
  uniqueIndex('orders_one_unresolved_per_account_idx').on(t.executionAccount).where(sql`
    ${t.brokerStatus} IN ('PREPARING','SUBMITTING','UNKNOWN','SUBMITTED','PARTIALLY_FILLED') OR
    (${t.brokerStatus} IN ('FILLED','CANCELLED') AND ${t.positionsSyncedAt} IS NULL)`),
  check('order_fill_range', sql`${t.filledQuantity} >= 0 AND ${t.filledQuantity} <= ${t.quantity} AND ${t.filledAmount} >= 0`),
  check('order_quantity_positive', sql`${t.quantity} > 0`),
  check('order_price_positive', sql`${t.price} > 0`),
  check('order_currency_code', sql`${t.currency} ~ '^[A-Z]{3}$'`),
]);

export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull(),
  executionAccount: text('execution_account'),
  syncedAt: instant('synced_at'),
  quantity: quantity('quantity').notNull(),
  averagePrice: money('average_price').notNull(),
  currency: text('currency').notNull(),
  realizedPnl: money('realized_pnl').notNull().default('0'),
  unrealizedPnl: money('unrealized_pnl').notNull().default('0'),
  openedAt: instant('opened_at').notNull().defaultNow(),
  closedAt: instant('closed_at'),
}, (t) => [
  uniqueIndex('positions_execution_symbol_idx').on(t.executionAccount, t.symbol),
  check('position_quantity_nonnegative', sql`${t.quantity} >= 0`),
  check('position_average_price_nonnegative', sql`${t.averagePrice} >= 0`),
  check('position_time_order', sql`${t.closedAt} IS NULL OR ${t.closedAt} >= ${t.openedAt}`),
  check('position_currency_code', sql`${t.currency} ~ '^[A-Z]{3}$'`),
]);

/** Cumulative broker execution snapshots, not inferred fills from order acceptance. */
export const orderFills = pgTable('order_fills', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  filledQuantity: quantity('filled_quantity').notNull(),
  filledAmount: money('filled_amount').notNull(),
  brokerStatus: text('broker_status').notNull(),
  observedAt: instant('observed_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('order_fills_snapshot_idx').on(t.orderId, t.filledQuantity, t.filledAmount, t.brokerStatus)]);

export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  cash: money('cash').notNull(),
  marketValue: money('market_value').notNull(),
  totalEquity: money('total_equity').notNull(),
  currency: text('currency').notNull(),
  realizedPnl: money('realized_pnl').notNull(),
  unrealizedPnl: money('unrealized_pnl').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [check('snapshot_currency_code', sql`${t.currency} ~ '^[A-Z]{3}$'`)]);
