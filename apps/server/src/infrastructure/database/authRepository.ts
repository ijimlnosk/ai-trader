import { and, eq, gt, lte, sql } from 'drizzle-orm';
import type { AuthRepository } from '../../application/auth/ports.ts';
import type { createDatabase } from './index.ts';
import { consoleUsers as users, consoleSessions as sessions } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];
export function createAuthRepository(db: Database): AuthRepository {
  return {
    async findUser(email) {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user ?? null;
    },
    async consumeAttempt(key, maximum, windowSeconds) {
      if (key === 'login-global') await db.execute(sql`DELETE FROM console_login_attempts WHERE resets_at < now() - interval '1 day'`);
      const result = await db.execute(sql`
        INSERT INTO console_login_attempts(key, attempts, resets_at)
        VALUES (${key}, 1, now() + ${windowSeconds} * interval '1 second')
        ON CONFLICT (key) DO UPDATE SET
          attempts = CASE WHEN console_login_attempts.resets_at <= now() THEN 1 ELSE console_login_attempts.attempts + 1 END,
          resets_at = CASE WHEN console_login_attempts.resets_at <= now() THEN now() + ${windowSeconds} * interval '1 second' ELSE console_login_attempts.resets_at END
        WHERE console_login_attempts.resets_at <= now() OR console_login_attempts.attempts < ${maximum}
        RETURNING key`);
      return result.rows.length === 1;
    },
    async createSession(user, tokenHash, expiresAt) {
      return db.transaction(async tx => {
        const [current] = await tx.select().from(users).where(eq(users.id, user.id)).for('update');
        if (!current || current.disabled || current.passwordHash !== user.passwordHash) return false;
        await tx.delete(sessions).where(and(eq(sessions.userId, user.id), lte(sessions.expiresAt, new Date())));
        await tx.insert(sessions).values({ userId: user.id, tokenHash, expiresAt: new Date(expiresAt) });
        return true;
      });
    },
    async session(tokenHash) {
      const [row] = await db.select({ id: users.id, email: users.email, executionAccount: users.executionAccount, expiresAt: sessions.expiresAt })
        .from(sessions).innerJoin(users, eq(sessions.userId, users.id))
        .where(and(eq(sessions.tokenHash, tokenHash), eq(users.disabled, false), gt(sessions.expiresAt, new Date())));
      return row ? { ...row, expiresAt: row.expiresAt.toISOString() } : null;
    },
    async revoke(tokenHash) { await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)); },
  };
}
