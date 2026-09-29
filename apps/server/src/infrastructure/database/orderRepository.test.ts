import { createPaperLoopRepository } from './paperLoopRepository.ts';
import { createDailySnapshotRepository } from './dailySnapshotRepository.ts';
import { createConsoleReadRepository } from './consoleReadRepository.ts';
import { createDailySnapshotCollector } from '../../application/marketData/collect.ts';
import { createPaperLoopPreparer } from '../../application/paperLoop/prepare.ts';
import { bar, stubHistory } from '../../../test/marketDataFixtures.ts';
import { paperLoopSetup } from '../../../test/paperLoopSetup.ts';
import { loopOrderKey } from '../../application/paperLoop/input.ts';
import { createPaperLoop } from '../../application/paperLoop/index.ts';
import { createStrategyService } from '../../application/strategy/index.ts';
import { createPaperPortfolioRiskContextProvider } from '../../application/paperRiskContext.ts';
import { createOrderServices } from '../../application/orders/index.ts';
import { strategySetup } from '../../../test/strategySetup.ts';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, eq, isNull } from 'drizzle-orm';
import { createDatabase } from './index.ts';
import { createOrderRepository } from './orderRepository.ts';
import { orders, orderFills, positions, executions, tradeProposals } from './schema.ts';
import { input, position, portfolio, time } from '../../../test/orderFixtures.ts';

// Only an explicitly provisioned disposable DB is permitted; no production DATABASE_URL fallback.
const testUrl = process.env.ORDER_TEST_DATABASE_URL;
describe.skipIf(!testUrl)('PostgreSQL order persistence and migration', () => {
  let database: ReturnType<typeof createDatabase>;
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/ai_trader_order_test_')) throw new Error('Disposable order test database required');
    database = createDatabase(testUrl!);
    const base = await readFile(new URL('../../../drizzle/0000_stormy_albert_cleary.sql', import.meta.url), 'utf8');
    const migration = await readFile(new URL('../../../drizzle/0001_nasty_redwing.sql', import.meta.url), 'utf8');
    await database.db.execute(sql.raw(base));
    await database.db.execute(sql`WITH p AS (INSERT INTO trade_proposals(symbol, side, score, confidence, reason, risk)
      VALUES ('005930','BUY',0,0.82,'legacy','legacy') RETURNING id)
      INSERT INTO orders(proposal_id,symbol,side,quantity,price,currency) SELECT id,'005930','BUY',1,70000,'KRW' FROM p`);
    await database.db.execute(sql.raw(migration));
    await database.db.execute(sql`WITH p AS (INSERT INTO trade_proposals(symbol, side, score, confidence, reason, risk)
      VALUES ('005930','BUY',0,0.82,'historical','approved') RETURNING id)
      INSERT INTO orders(proposal_id,symbol,side,quantity,price,currency,execution_account,broker_order_id,
        broker_order_date,broker_status,filled_quantity,filled_amount,positions_synced_at)
      SELECT id,'005930','BUY',2,70000,'KRW','historical-account','987','20260915','FILLED',2,140000,now() FROM p`);
    const ledgerMigration = await readFile(new URL('../../../drizzle/0002_lean_black_panther.sql', import.meta.url), 'utf8');
    await database.db.execute(sql.raw(ledgerMigration));
    for (const name of ['0003_tearful_smasher', '0004_paper_loop_claims', '0005_market_daily_snapshots', '0006_console_auth']) {
      await database.db.execute(sql.raw(await readFile(new URL(`../../../drizzle/${name}.sql`, import.meta.url), 'utf8')));
    }
  });
  afterAll(async () => { if (database) await database.close(); });
  it('archives market snapshots idempotently and restores digest-stable datasets from JSONB', async () => {
    const repo = createDailySnapshotRepository(database.db);
    const now = () => new Date('2026-09-29T00:00:00.000Z');
    const week = [bar('20260922'), bar('20260923'), bar('20260928')];
    const first = await createDailySnapshotCollector({ history: stubHistory(week), snapshots: repo, now })('000660');
    const again = await createDailySnapshotCollector({ history: stubHistory(week, '2026-09-29T01:00:00.000Z'), snapshots: repo, now })('000660');
    expect(first.status).toBe('saved'); expect(again.status).toBe('unchanged');
    const revised = await createDailySnapshotCollector({ history: stubHistory([bar('20260922'), bar('20260923', '9'), bar('20260928')]),
      snapshots: createDailySnapshotRepository(database.db), now })('000660');
    expect(revised).toMatchObject({ status: 'saved', snapshot: { revisedDates: ['20260923'] } });
    expect((await repo.latestThrough('000660', '20260928'))?.id).toBe(revised.status === 'saved' ? revised.snapshot.id : '');
    await createDailySnapshotCollector({ history: stubHistory(week), snapshots: repo, now })('005930');
    const prepared = await createPaperLoopPreparer({ snapshots: createDailySnapshotRepository(database.db),
      now: () => new Date('2026-09-29T00:05:00.000Z') })();
    expect(prepared.status).toBe('ready');
  });
  it('console reads are newest-first, bounded and scoped to the execution account', async () => {
    const scope = randomUUID(); const repo = createOrderRepository(database.db, scope);
    const first = await repo.reserve(randomUUID(), input); await repo.update(first.order, { brokerStatus: 'FAILED' });
    await repo.reserve(randomUUID(), { ...input, quantity: '2' });
    await createOrderRepository(database.db, randomUUID()).reserve(randomUUID(), input);
    const console = createConsoleReadRepository(database.db, scope);
    const listed = await console.listOrders(10);
    expect(listed.map((order) => order.quantity)).toEqual(['2', input.quantity]);
    expect(await console.listOrders(1)).toHaveLength(1);
    expect(await createConsoleReadRepository(database.db, randomUUID()).listLoopRuns(10)).toEqual([]);
    expect((await console.listSnapshots(2)).length).toBeGreaterThan(0);
  });
  it('preserves existing rows after expansion', async () => {
    const legacy = await database.db.select().from(orders).where(isNull(orders.executionAccount));
    expect(legacy).toHaveLength(1); expect(legacy[0]).toMatchObject({ price: '70000.00000000', executionAccount: null, brokerStatus: null });
  });
  it('simultaneous same-key requests create exactly one row and survive repository recreation', async () => {
    const scope = randomUUID(); const key = randomUUID(); const repo = createOrderRepository(database.db, scope);
    const results = await Promise.all([repo.reserve(key, input), repo.reserve(key, input)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(results[0]!.order.id).toBe(results[1]!.order.id);
    const replay = await createOrderRepository(database.db, scope).reserve(key, input);
    expect(replay.created).toBe(false);
    await expect(repo.reserve(key, { ...input, quantity: '2' })).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });
  it('persists strategy inputs and replays JSONB metadata across repository instances', async () => {
    const scenario = strategySetup();
    await scenario.evaluate(scenario.data, '005930');
    const request = [...scenario.rows.values()][0]!.request;
    const account = randomUUID(); const key = randomUUID();
    const repo = createOrderRepository(database.db, account);
    const first = await repo.reserve(key, request);
    const replay = await createOrderRepository(database.db, account).reserve(key, request);
    expect(replay.created).toBe(false);
    expect(replay.order.request).toEqual(request);
    const [proposal] = await database.db.select().from(tradeProposals).where(eq(tradeProposals.id, first.order.proposalId));
    expect(proposal?.reason).toBe('ema-cross:1:BULLISH_CROSS');
    await expect(repo.reserve(key, { ...request, strategy: { ...request.strategy!, source: 'changed' } }))
      .rejects.toMatchObject({ code: 'idempotency_conflict' });
  });
  it('different keys cannot reserve the same account; different accounts remain independent', async () => {
    const repo = createOrderRepository(database.db, randomUUID());
    const results = await Promise.allSettled([repo.reserve(randomUUID(), input), repo.reserve(randomUUID(), input)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await createOrderRepository(database.db, randomUUID()).reserve(randomUUID(), input)).created).toBe(true);
  });
  it('commits state before submission and rejects stale writers', async () => {
    const repo = createOrderRepository(database.db, randomUUID());
    const { order } = await repo.reserve(randomUUID(), input);
    const sending = await repo.update(order, { brokerStatus: 'SUBMITTING', riskStatus: 'approved', requestedPrice: '70000' });
    expect(await repo.get(order.id)).toMatchObject({ brokerStatus: 'SUBMITTING', riskStatus: 'approved', requestedPrice: '70000.00000000' });
    await expect(repo.update(order, { brokerStatus: 'FAILED' })).rejects.toMatchObject({ code: 'order_conflict' });
    await repo.update(sending, { brokerStatus: 'UNKNOWN' });
    await expect(repo.reserve(randomUUID(), input)).rejects.toMatchObject({ code: 'account_busy' });
  });
  it('saves cumulative fills and position mirror atomically without double-counting, then releases the account', async () => {
    const scope = randomUUID(); const repo = createOrderRepository(database.db, scope);
    let { order } = await repo.reserve(randomUUID(), input);
    order = await repo.update(order, { brokerStatus: 'SUBMITTED', brokerOrderId: '123', brokerOrderDate: '20260916' });
    const patch = { brokerStatus: 'FILLED' as const, filledQuantity: '1', filledAmount: '70000', positionsSyncedAt: new Date().toISOString() };
    order = await repo.reconcile(order, patch, { ...portfolio, positions: [position] });
    await repo.reconcile(order, patch, { ...portfolio, positions: [position] });
    expect(await database.db.select().from(orderFills).where(eq(orderFills.orderId, order.id))).toHaveLength(1);
    expect(await database.db.select().from(executions).where(eq(executions.orderId, order.id))).toHaveLength(1);
    expect(await repo.getTradeLedger('20260916')).toMatchObject({ dailyRealizedPnl: '0', positions: [{ quantity: '1', costAmount: '70000' }] });
    expect(await database.db.select().from(positions).where(eq(positions.executionAccount, scope))).toMatchObject([{ quantity: '1.00000000' }]);
    expect((await repo.reserve(randomUUID(), input)).created).toBe(true);
  });
  it('rolls back the fill and order update when position persistence fails', async () => {
    const repo = createOrderRepository(database.db, randomUUID());
    let { order } = await repo.reserve(randomUUID(), input);
    order = await repo.update(order, { brokerStatus: 'SUBMITTED', brokerOrderId: '123', brokerOrderDate: '20260916' });
    await expect(repo.reconcile(order, { brokerStatus: 'FILLED', filledQuantity: '1', filledAmount: '70000' },
      { ...portfolio, positions: [{ ...position, averagePrice: '-1' }] })).rejects.toThrow();
    expect((await repo.get(order.id))?.brokerStatus).toBe('SUBMITTED');
    expect(await database.db.select().from(orderFills).where(eq(orderFills.orderId, order.id))).toHaveLength(0);
    expect(await database.db.select().from(executions).where(eq(executions.orderId, order.id))).toHaveLength(0);
  });
  it('backfills confirmed historical quantities without resetting acquired cost', async () => {
    expect(await createOrderRepository(database.db, 'historical-account').getTradeLedger('20260916'))
      .toEqual({ dailyRealizedPnl: '0', consecutiveLosses: 0, positions: [{ symbol: '005930', quantity: '2', costAmount: '140000' }] });
    expect(await database.db.select().from(executions).where(eq(executions.executionAccount, 'historical-account')))
      .toMatchObject([{ source: 'legacy_order_backfill', quantity: '2.00000000', amount: '140000.00000000' }]);
  });
  it('partial fills, simultaneous reconciliation, cancellation, sale and restart preserve exact history', async () => {
    const scope = randomUUID(); const repo = createOrderRepository(database.db, scope);
    let { order } = await repo.reserve(randomUUID(), { ...input, quantity: '3' });
    order = await repo.update(order, { brokerStatus: 'SUBMITTED', brokerOrderId: '201', brokerOrderDate: '20260916' });
    const patch = { brokerStatus: 'PARTIALLY_FILLED' as const, filledQuantity: '1', filledAmount: '70000' };
    const raced = await Promise.allSettled([repo.reconcile(order, patch, portfolio), repo.reconcile(order, patch, portfolio)]);
    expect(raced.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    order = (await repo.get(order.id))!;
    order = await repo.reconcile(order, { ...patch, filledQuantity: '2', filledAmount: '150000' }, portfolio);
    await repo.reconcile(order, { brokerStatus: 'CANCELLED', positionsSyncedAt: new Date().toISOString() }, portfolio);
    expect(await database.db.select().from(executions).where(eq(executions.orderId, order.id))).toHaveLength(2);
    let { order: sell } = await repo.reserve(randomUUID(), { ...input, side: 'SELL', quantity: '2' });
    sell = await repo.update(sell, { brokerStatus: 'SUBMITTED', brokerOrderId: '202', brokerOrderDate: '20260916' });
    sell = await repo.reconcile(sell, { brokerStatus: 'PARTIALLY_FILLED', filledQuantity: '1', filledAmount: '70000' }, portfolio);
    await repo.reconcile(sell, { brokerStatus: 'FILLED', filledQuantity: '2', filledAmount: '130000', positionsSyncedAt: new Date().toISOString() }, portfolio);
    const restarted = createOrderRepository(database.db, scope);
    expect(await restarted.getTradeLedger('20260916')).toEqual({ dailyRealizedPnl: '-20000', consecutiveLosses: 1, positions: [] });
    expect(await restarted.getTradeLedger('20260917')).toMatchObject({ dailyRealizedPnl: '0', consecutiveLosses: 1 });
    expect(await createOrderRepository(database.db, randomUUID()).getTradeLedger('20260916'))
      .toEqual({ dailyRealizedPnl: '0', consecutiveLosses: 0, positions: [] });
  });
  it('a missing execution for persisted filled quantity fails closed instead of zeroing history', async () => {
    const repo = createOrderRepository(database.db, randomUUID());
    const { order } = await repo.reserve(randomUUID(), input);
    await repo.update(order, { brokerStatus: 'FILLED', filledQuantity: '1', filledAmount: '70000',
      brokerOrderDate: '20260916', brokerOrderId: '301', positionsSyncedAt: new Date().toISOString() });
    await expect(repo.getTradeLedger('20260916')).rejects.toThrow('Incomplete trade ledger');
  });

  it('paper-loop claims survive races/restart and isolate accounts, bars and keys', async () => {
    const s = paperLoopSetup(); const scope = randomUUID(); const key = loopOrderKey(s.input);
    const repo = createPaperLoopRepository(database.db, scope);
    const claims = await Promise.all([repo.claim(s.input, key, time), repo.claim(s.input, key, time)]);
    expect(claims.filter(c => c.created)).toHaveLength(1);
    expect(claims[0]!.run.id).toBe(claims[1]!.run.id);
    const restarted = createPaperLoopRepository(database.db, scope);
    expect((await restarted.find(s.input.runKey, key))?.input).toEqual(s.input);
    await expect(restarted.claim({ ...s.input, dataRef: 'changed' }, key, time)).rejects.toMatchObject({ code: 'loop_conflict' });
    await expect(repo.claim({ ...s.input, runKey: 'other' }, randomUUID(), time)).rejects.toMatchObject({ code: 'loop_busy' });
    expect((await createPaperLoopRepository(database.db, randomUUID()).claim(s.input, key, time)).created).toBe(true);
    const first = claims[0]!.run;
    await repo.update(first, { status: 'COMPLETE', result: null, order: null, reason: null });
    await expect(repo.update(first, { status: 'HALTED', result: null, order: null, reason: 'stale' })).rejects.toMatchObject({ code: 'loop_conflict' });
    expect((await repo.claim({ ...s.input, runKey: 'other' }, randomUUID(), time)).created).toBe(true);
  });
  it('paper-loop order lookup is account scoped and blockers match execution reservation', async () => {
    const scope = randomUUID(); const ordersRepo = createOrderRepository(database.db, scope);
    const repo = createPaperLoopRepository(database.db, scope); const key = randomUUID();
    expect(await repo.hasUnresolvedOrder()).toBe(false);
    const { order } = await ordersRepo.reserve(key, input);
    expect((await repo.findOrder(key))?.id).toBe(order.id); expect(await repo.hasUnresolvedOrder()).toBe(true);
    expect(await createPaperLoopRepository(database.db, randomUUID()).findOrder(key)).toBeNull();
    const filled = await ordersRepo.update(order, { brokerStatus: 'FILLED' });
    expect(await repo.hasUnresolvedOrder()).toBe(true);
    await ordersRepo.update(filled, { positionsSyncedAt: time });
    expect(await repo.hasUnresolvedOrder()).toBe(false);
  });
  it('real loop plus durable repositories submits once across concurrent callers and restart', async () => {
    const s = paperLoopSetup(); const scope = randomUUID();
    const repository = createOrderRepository(database.db, scope);
    const orders = createOrderServices({ ...s.deps, repository });
    const strategy = createStrategyService({ ...s.strategyDeps, orders,
      risk: createPaperPortfolioRiskContextProvider(s.account, repository, false, s.deps.now) });
    s.broker.getOrderFill.mockResolvedValue(null);
    const deps = { ...s.loopDeps, strategy, orders, repository: createPaperLoopRepository(database.db, scope) };
    const tick = createPaperLoop(deps);
    const results = await Promise.allSettled([tick(s.input), tick(s.input)]);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
    const restarted = createPaperLoop({ ...deps, repository: createPaperLoopRepository(database.db, scope), enabled: false });
    const recovered = await restarted(s.input);
    expect(recovered.order?.brokerStatus).toBe('SUBMITTED');
    expect(s.broker.submitOrder).toHaveBeenCalledTimes(1);
    const changed = { ...s.input, runKey: 'new-key-same-bar' };
    await expect(restarted(changed)).rejects.toMatchObject({ code: 'loop_conflict' });
  });

});
