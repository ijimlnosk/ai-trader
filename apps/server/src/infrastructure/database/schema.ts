import { sql } from 'drizzle-orm';
import { check, index, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
  price: money('price').notNull(),
  currency: text('currency').notNull(),
  status: orderStatus('status').notNull().default('pending'),
  brokerOrderId: text('broker_order_id'),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (t) => [
  index('orders_proposal_id_idx').on(t.proposalId),
  check('order_quantity_positive', sql`${t.quantity} > 0`),
  check('order_price_positive', sql`${t.price} > 0`),
  check('order_currency_code', sql`${t.currency} ~ '^[A-Z]{3}$'`),
]);

export const positions = pgTable('positions', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull(),
  quantity: quantity('quantity').notNull(),
  averagePrice: money('average_price').notNull(),
  currency: text('currency').notNull(),
  realizedPnl: money('realized_pnl').notNull().default('0'),
  unrealizedPnl: money('unrealized_pnl').notNull().default('0'),
  openedAt: instant('opened_at').notNull().defaultNow(),
  closedAt: instant('closed_at'),
}, (t) => [
  check('position_quantity_nonnegative', sql`${t.quantity} >= 0`),
  check('position_average_price_nonnegative', sql`${t.averagePrice} >= 0`),
  check('position_time_order', sql`${t.closedAt} IS NULL OR ${t.closedAt} >= ${t.openedAt}`),
  check('position_currency_code', sql`${t.currency} ~ '^[A-Z]{3}$'`),
]);

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
