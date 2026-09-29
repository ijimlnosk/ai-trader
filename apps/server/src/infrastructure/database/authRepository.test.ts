import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDatabase } from './index.ts';
import { createAuthRepository } from './authRepository.ts';
import { consoleUsers as users, consoleSessions as sessions } from './schema.ts';
import { manageUser } from '../auth/manageUser.ts';

const testUrl = process.env.AUTH_TEST_DATABASE_URL;
describe.skipIf(!testUrl)('isolated PostgreSQL authentication', () => {
  let database: ReturnType<typeof createDatabase>;
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.startsWith('/ai_trader_auth_test_')) throw new Error('Disposable auth DB required');
    database = createDatabase(testUrl!);
    await database.db.execute(sql.raw(await readFile(new URL('../../../drizzle/0006_console_auth.sql', import.meta.url), 'utf8')));
  });
  afterAll(async () => { await database?.close(); });
  async function fixture() {
    const [user] = await database.db.insert(users).values({ email: `${randomUUID()}@example.test`, passwordHash: 'fixture-hash', executionAccount: randomUUID() }).returning();
    return user!;
  }
  it('enforces one owner per account and unique login emails without overwriting data', async () => {
    const user = await fixture();
    await expect(database.db.insert(users).values({ ...user, id: randomUUID(), email: 'duplicate@example.test' })).rejects.toThrow();
    await expect(database.db.insert(users).values({ ...user, id: randomUUID(), executionAccount: null })).rejects.toThrow();
    expect(await createAuthRepository(database.db).findUser(user.email)).toMatchObject({ executionAccount: user.executionAccount });
  });
  it('sessions survive restart, follow current ownership, reject disabled/expired users and revoke', async () => {
    const user = await fixture(); const hash = randomUUID(); const repo = createAuthRepository(database.db);
    expect(await repo.createSession(user, hash, new Date(Date.now() + 60000).toISOString())).toBe(true);
    expect(await createAuthRepository(database.db).session(hash)).toMatchObject({ id: user.id, executionAccount: user.executionAccount });
    await database.db.update(users).set({ executionAccount: 'changed-' + user.id }).where(eq(users.id, user.id));
    expect(await repo.session(hash)).toMatchObject({ executionAccount: 'changed-' + user.id });
    await database.db.update(users).set({ disabled: true }).where(eq(users.id, user.id));
    expect(await repo.session(hash)).toBeNull();
    await database.db.update(users).set({ disabled: false }).where(eq(users.id, user.id));
    await database.db.update(sessions).set({ expiresAt: new Date('2000-01-01') }).where(eq(sessions.tokenHash, hash));
    expect(await repo.session(hash)).toBeNull();
    await repo.revoke(hash);
    expect(await database.db.select().from(sessions).where(eq(sessions.tokenHash, hash))).toHaveLength(0);
  });
  it('applies atomic shared attempt budgets across concurrent instances', async () => {
    const key = randomUUID();
    const results = await Promise.all(Array.from({ length: 12 }, () => createAuthRepository(database.db).consumeAttempt(key, 5, 900)));
    expect(results.filter(Boolean)).toHaveLength(5);
    await database.db.execute(sql`UPDATE console_login_attempts SET resets_at = now() - interval '1 second' WHERE key = ${key}`);
    expect(await createAuthRepository(database.db).consumeAttempt(key, 5, 900)).toBe(true);
  });
  it('password reset and disable revoke every session and reject a stale concurrent login', async () => {
    const user = await fixture(); const repo = createAuthRepository(database.db);
    await repo.createSession(user, randomUUID(), new Date(Date.now() + 60000).toISOString());
    await manageUser(database.db, { action: 'reset-password', email: user.email, password: 'different-test-password-123' }, {});
    expect(await database.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    expect(await repo.createSession(user, randomUUID(), new Date(Date.now() + 60000).toISOString())).toBe(false);
    const current = (await repo.findUser(user.email))!;
    await repo.createSession(current, randomUUID(), new Date(Date.now() + 60000).toISOString());
    await manageUser(database.db, { action: 'disable', email: user.email }, {});
    expect(await repo.createSession(current, randomUUID(), new Date(Date.now() + 60000).toISOString())).toBe(false);
    expect(await database.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });
  it('creates unlinked users by default and explicitly binds only a configured paper account', async () => {
    const email = `${randomUUID()}@example.test`;
    await manageUser(database.db, { action: 'create', email, password: 'new-test-password-123' }, {});
    const [user] = await database.db.select().from(users).where(eq(users.email, email));
    expect(user?.executionAccount).toBeNull();
    await expect(manageUser(database.db, { action: 'bind', email }, { BROKER_MODE: 'live' })).rejects.toThrow();
    await manageUser(database.db, { action: 'bind', email }, { BROKER_MODE: 'paper', KIS_ACCOUNT_NO: '12345678', KIS_ACCOUNT_PRODUCT_CODE: '01' });
    const [bound] = await database.db.select().from(users).where(eq(users.email, email));
    expect(bound?.executionAccount).toMatch(/^[a-f0-9]{64}$/);
    await manageUser(database.db, { action: 'unbind', email }, {});
    expect((await database.db.select().from(users).where(eq(users.email, email)))[0]?.executionAccount).toBeNull();
  });
});
