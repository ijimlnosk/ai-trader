import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { emailSchema, newPasswordSchema } from '../../application/auth/index.ts';
import type { createDatabase } from '../database/index.ts';
import { consoleUsers as users, consoleSessions as sessions } from '../database/schema.ts';
import { hashPassword } from './password.ts';

const inputSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('create'), email: emailSchema, password: newPasswordSchema, bindConfiguredAccount: z.boolean().default(false) }),
  z.strictObject({ action: z.literal('reset-password'), email: emailSchema, password: newPasswordSchema }),
  z.strictObject({ action: z.enum(['disable', 'enable', 'bind', 'unbind']), email: emailSchema }),
]);
export async function manageUser(db: ReturnType<typeof createDatabase>['db'], raw: unknown, environment: Record<string, string | undefined>) {
  const input = inputSchema.parse(raw);
  const binds = input.action === 'bind' || (input.action === 'create' && input.bindConfiguredAccount);
  let executionAccount: string | null = null;
  if (binds) {
    if (environment.BROKER_MODE !== 'paper' || !/^\d{8}$/.test(environment.KIS_ACCOUNT_NO ?? '')
      || !/^\d{2}$/.test(environment.KIS_ACCOUNT_PRODUCT_CODE ?? '')) throw new Error('Configured paper account required');
    executionAccount = createHash('sha256').update(`paper:${environment.KIS_ACCOUNT_NO}:${environment.KIS_ACCOUNT_PRODUCT_CODE}`).digest('hex');
  }
  const passwordHash = 'password' in input ? await hashPassword(input.password) : undefined;
  await db.transaction(async tx => {
    if (input.action === 'create') {
      await tx.insert(users).values({ email: input.email, passwordHash: passwordHash!, executionAccount });
      return;
    }
    const [user] = await tx.select().from(users).where(eq(users.email, input.email)).for('update');
    if (!user) throw new Error('User not found');
    if (input.action === 'reset-password') await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    else if (input.action === 'bind' || input.action === 'unbind') await tx.update(users).set({ executionAccount }).where(eq(users.id, user.id));
    else await tx.update(users).set({ disabled: input.action === 'disable' }).where(eq(users.id, user.id));
    // Invalidate all devices on every administrative change, in the same transaction/lock as login.
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  return { action: input.action, email: input.email };
}
