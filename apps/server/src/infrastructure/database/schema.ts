import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
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

/** Immutable observed cumulative deltas; amounts are gross KRW (fees/taxes unavailable). */
export const executions = pgTable('executions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  executionAccount: text('execution_account').notNull(),
  symbol: text('symbol').notNull(),
  side: orderSide('side').notNull(),
  tradeDate: text('trade_date').notNull(),
  quantity: quantity('quantity').notNull(),
  amount: money('amount').notNull(),
  cumulativeQuantity: quantity('cumulative_quantity').notNull(),
  cumulativeAmount: money('cumulative_amount').notNull(),
  observedAt: instant('observed_at').notNull().defaultNow(),
  source: text('source').notNull().default('reconciliation'),
}, (t) => [
  uniqueIndex('executions_order_cumulative_idx').on(t.orderId, t.cumulativeQuantity),
  index('executions_account_date_idx').on(t.executionAccount, t.tradeDate),
  check('execution_positive', sql`${t.quantity} > 0 AND ${t.amount} > 0 AND ${t.quantity} = trunc(${t.quantity})`),
  check('execution_cumulative_range', sql`${t.cumulativeQuantity} >= ${t.quantity} AND ${t.cumulativeAmount} >= ${t.amount}`),
  check('execution_trade_date', sql`${t.tradeDate} ~ '^[0-9]{8}$'`),
  check('execution_source', sql`${t.source} IN ('reconciliation', 'legacy_order_backfill')`),
]);

export const strategyRuns = pgTable('strategy_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runKey: text('run_key').notNull(),
  executionAccount: text('execution_account').notNull(),
  sessionDate: text('session_date').notNull(),
  dataSha256: text('data_sha256').notNull(),
  result: jsonb('result').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('strategy_runs_account_key_idx').on(t.executionAccount, t.runKey),
  check('strategy_runs_session_date', sql`${t.sessionDate} ~ '^[0-9]{8}$'`),
  check('strategy_runs_sha256', sql`${t.dataSha256} ~ '^[0-9a-f]{64}$'`),
]);

/** Execution-capable claims are isolated from order-free strategy_runs. */
export const paperLoopRuns = pgTable('paper_loop_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionAccount: text('execution_account').notNull(),
  runKey: text('run_key').notNull(),
  orderKey: text('order_key').notNull(),
  input: jsonb('input').$type<import('../../application/paperLoop/input.ts').PaperLoopInput>().notNull(),
  status: text('status').$type<import('../../application/paperLoop/ports.ts').LoopStatus>().notNull().default('CLAIMED'),
  result: jsonb('result').$type<import('../../application/paperLoop/ports.ts').PaperLoopRun['result']>(),
  order: jsonb('order_snapshot').$type<import('../../domain/orders.ts').OrderResponse>(),
  reason: text('reason'),
  deadline: instant('deadline').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
  version: integer('version').notNull().default(0),
}, (t) => [
  uniqueIndex('paper_loop_account_run_idx').on(t.executionAccount, t.runKey),
  uniqueIndex('paper_loop_account_order_idx').on(t.executionAccount, t.orderKey),
  uniqueIndex('paper_loop_account_active_idx').on(t.executionAccount).where(sql`${t.status} <> 'COMPLETE'`),
  check('paper_loop_status', sql`${t.status} IN ('CLAIMED','TRACKING','COMPLETE','HALTED')`),
]);

/** Archived provider daily bars; shared market data, not account-scoped. */
export const marketDailySnapshots = pgTable('market_daily_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull(),
  through: text('through').notNull(),
  collectedAt: instant('collected_at').notNull(),
  calendarVersion: text('calendar_version').notNull(),
  rawSha256: text('raw_sha256').notNull(),
  dataset: jsonb('dataset').$type<import('../../domain/strategy/marketData.ts').MarketDataset>().notNull(),
  datasetSha256: text('dataset_sha256').notNull(),
  candlesSha256: text('candles_sha256').notNull(),
  revisedDates: jsonb('revised_dates').$type<string[]>().notNull(),
  // Latest retrieval that returned exactly these candles; null means only the first retrieval.
  confirmedAt: instant('confirmed_at'),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('market_daily_snapshot_data_idx').on(t.symbol, t.through, t.candlesSha256),
  index('market_daily_snapshot_latest_idx').on(t.symbol, t.through, t.createdAt),
  check('market_daily_snapshot_symbol', sql`${t.symbol} ~ '^[0-9]{6}$'`),
  check('market_daily_snapshot_through', sql`${t.through} ~ '^[0-9]{8}$'`),
  check('market_daily_snapshot_sha256', sql`${t.rawSha256} ~ '^[0-9a-f]{64}$' AND ${t.datasetSha256} ~ '^[0-9a-f]{64}$' AND ${t.candlesSha256} ~ '^[0-9a-f]{64}$'`),
]);


/** Local console identities; account ownership is explicit and never inferred from login. */
export const consoleUsers = pgTable('console_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  executionAccount: text('execution_account'),
  disabled: boolean('disabled').notNull().default(false),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('console_users_email_idx').on(t.email),
  uniqueIndex('console_users_account_idx').on(t.executionAccount)]);

export const consoleSessions = pgTable('console_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => consoleUsers.id, { onDelete: 'cascade' }),
  expiresAt: instant('expires_at').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [index('console_sessions_user_idx').on(t.userId)]);

export const consoleLoginAttempts = pgTable('console_login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  resetsAt: instant('resets_at').notNull(),
});

/**
 * Owner-controlled pause/resume of automatic paper trading, per execution account. It can only
 * narrow what the environment allows; a missing row means paused.
 */
export const tradingControls = pgTable('trading_controls', {
  executionAccount: text('execution_account').primaryKey(),
  autoTradingEnabled: boolean('auto_trading_enabled').notNull().default(false),
  updatedBy: uuid('updated_by').references(() => consoleUsers.id, { onDelete: 'set null' }),
  updatedAt: instant('updated_at').notNull().defaultNow(),
});

/** Append-only audit of control changes. */
export const tradingControlEvents = pgTable('trading_control_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  executionAccount: text('execution_account').notNull(),
  userId: uuid('user_id').references(() => consoleUsers.id, { onDelete: 'set null' }),
  autoTradingEnabled: boolean('auto_trading_enabled').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [index('trading_control_events_account_idx').on(t.executionAccount, t.createdAt)]);

/** Per-provider call counters by Seoul day ('d:YYYYMMDD') and month ('m:YYYYMM'); consumed before each call. */
export const externalApiUsage = pgTable('external_api_usage', {
  provider: text('provider').notNull(),
  period: text('period').notNull(),
  used: integer('used').notNull().default(0),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.provider, t.period] }), check('external_api_usage_used', sql`${t.used} >= 0`)]);

/** Archived news search results per universe symbol; never used for orders directly. */
export const newsItems = pgTable('news_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbol: text('symbol').notNull(),
  provider: text('provider').notNull(),
  query: text('query').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  link: text('link').notNull(),
  originalLink: text('original_link'),
  publishedAt: instant('published_at').notNull(),
  collectedAt: instant('collected_at').notNull(),
}, (t) => [uniqueIndex('news_items_symbol_link_idx').on(t.symbol, t.link), index('news_items_published_idx').on(t.publishedAt)]);

/** One AI news screening per session and symbol; order-free until enforcement is enabled. */
export const newsAssessments = pgTable('news_assessments', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionDate: text('session_date').notNull(),
  symbol: text('symbol').notNull(),
  model: text('model').notNull(),
  status: text('status').notNull(),
  verdict: text('verdict'),
  assessment: jsonb('assessment'),
  reason: text('reason'),
  articleCount: integer('article_count').notNull(),
  inputSha256: text('input_sha256').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costMicroUsd: integer('cost_micro_usd'),
  createdAt: instant('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('news_assessments_session_symbol_idx').on(t.sessionDate, t.symbol),
  check('news_assessments_status', sql`${t.status} IN ('assessed','unavailable','no_news','budget_exhausted')`)]);
