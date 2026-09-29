import { vi } from 'vitest';
import { createAuth } from '../src/application/auth/index.ts';
import type { AuthRepository, SessionIdentity } from '../src/application/auth/ports.ts';

export function authSetup() {
  const user = { id: 'u1', email: 'owner@example.test', passwordHash: 'test-hash', disabled: false };
  const identity = { id: user.id, email: user.email, executionAccount: 'account-a' as string | null };
  const sessions = new Map<string, SessionIdentity>();
  const repository = {
    findUser: vi.fn(async (email: string) => email === user.email ? user : null),
    consumeAttempt: vi.fn(async () => true),
    createSession: vi.fn(async (_user, tokenHash, expiresAt) => { sessions.set(tokenHash, { ...identity, expiresAt }); return true; }),
    session: vi.fn(async (tokenHash: string) => sessions.get(tokenHash) ?? null),
    revoke: vi.fn(async (tokenHash: string) => { sessions.delete(tokenHash); }),
  } satisfies AuthRepository;
  const passwords = { verify: vi.fn(async (password: string, hash: string | null) => password === 'test-password-at-least-15' && hash === user.passwordHash) };
  const auth = createAuth(repository, passwords);
  const credentials = { email: user.email, password: 'test-password-at-least-15' };
  return { auth, repository, passwords, sessions, user, identity, credentials };
}
