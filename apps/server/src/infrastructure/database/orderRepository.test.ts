import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql, eq, isNull } from 'drizzle-orm';
import { createDatabase } from './index.ts';
import { createOrderRepository } from './orderRepository.ts';
import { orders, orderFills, positions } from './schema.ts';
import { input, position, portfolio } from '../../../test/orderFixtures.ts';

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
  });
  afterAll(async () => { if (database) await database.close(); });
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
    expect(await database.db.select().from(positions).where(eq(positions.executionAccount, scope))).toMatchObject([{ quantity: '1.00000000' }]);
    expect((await repo.reserve(randomUUID(), input)).created).toBe(true);
  });
  it('rolls back the fill and order update when position persistence fails', async () => {
    const repo = createOrderRepository(database.db, randomUUID());
    const { order } = await repo.reserve(randomUUID(), input);
    await expect(repo.reconcile(order, { brokerStatus: 'FILLED', filledQuantity: '1', filledAmount: '70000' },
      { ...portfolio, positions: [{ ...position, averagePrice: '-1' }] })).rejects.toThrow();
    expect((await repo.get(order.id))?.brokerStatus).toBe('PREPARING');
    expect(await database.db.select().from(orderFills).where(eq(orderFills.orderId, order.id))).toHaveLength(0);
  });
});
