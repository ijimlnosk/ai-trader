import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { ConsoleSessionResponse } from '@ai-trader/contracts';
import { AuthError, type AuthRepository, type PasswordVerifier, type SessionIdentity } from './ports.ts';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const loginSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(128) });
export const newPasswordSchema = z.string().min(15).max(128);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const SESSION_SECONDS = 8 * 3600;
export function sessionResponse(identity: SessionIdentity, configuredAccount: string): ConsoleSessionResponse {
  return { user: { id: identity.id, email: identity.email, hasTradingAccount: identity.executionAccount === configuredAccount }, expiresAt: identity.expiresAt };
}
export function createAuth(repository: AuthRepository, passwords: PasswordVerifier, now = () => new Date()) {
  let hashing = 0;
  return {
    async login(raw: unknown) {
      const input = loginSchema.parse(raw);
      if (hashing >= 2 || !await repository.consumeAttempt('login-global', 40, 60)
        || !await repository.consumeAttempt(hash(input.email), 5, 900)) throw new AuthError('login_rate_limited');
      const user = await repository.findUser(input.email);
      // Bound expensive password work as well as attempts, including unknown/disabled users.
      if (hashing >= 2) throw new AuthError('login_rate_limited');
      hashing++;
      let valid: boolean;
      try { valid = await passwords.verify(input.password, user?.passwordHash ?? null); }
      finally { hashing--; }
      if (!valid || !user || user.disabled) throw new AuthError('unauthorized');
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(now().getTime() + SESSION_SECONDS * 1000).toISOString();
      if (!await repository.createSession(user, hash(token), expiresAt)) throw new AuthError('unauthorized');
      return { token, expiresAt };
    },
    async authenticate(token: string | undefined) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AuthError('unauthorized');
      const identity = await repository.session(hash(token));
      if (!identity || Date.parse(identity.expiresAt) <= now().getTime()) throw new AuthError('unauthorized');
      return identity;
    },
    /**
     * Step-up check for a sensitive action by an already signed-in user. Shares the per-email
     * budget with login, so repeated wrong passwords here also lock login for the window.
     */
    async reauthenticate(identity: SessionIdentity, password: unknown) {
      const input = loginSchema.parse({ email: identity.email, password });
      if (hashing >= 2 || !await repository.consumeAttempt(hash(input.email), 5, 900)) throw new AuthError('login_rate_limited');
      const user = await repository.findUser(input.email);
      hashing++;
      let valid: boolean;
      try { valid = await passwords.verify(input.password, user?.passwordHash ?? null); }
      finally { hashing--; }
      if (!valid || !user || user.disabled || user.id !== identity.id) throw new AuthError('password_incorrect');
    },
    async logout(token: string | undefined) {
      if (token && /^[a-f0-9]{64}$/.test(token)) await repository.revoke(hash(token));
    },
  };
}
export type AuthService = ReturnType<typeof createAuth>;
