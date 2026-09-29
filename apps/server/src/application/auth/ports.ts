export interface LoginUser { id: string; email: string; passwordHash: string; disabled: boolean }
export interface SessionIdentity { id: string; email: string; executionAccount: string | null; expiresAt: string }
export interface AuthRepository {
  findUser(email: string): Promise<LoginUser | null>;
  /** Atomic fixed-window budget, shared across processes. Key is hashed, never a raw email. */
  consumeAttempt(key: string, maximum: number, windowSeconds: number): Promise<boolean>;
  /** Conditional on the credential still being current and enabled under the user row lock. */
  createSession(user: LoginUser, tokenHash: string, expiresAt: string): Promise<boolean>;
  session(tokenHash: string): Promise<SessionIdentity | null>;
  revoke(tokenHash: string): Promise<void>;
}
export interface PasswordVerifier { verify(password: string, hash: string | null): Promise<boolean> }
export class AuthError extends Error {
  constructor(public readonly code: 'unauthorized' | 'login_rate_limited' | 'account_not_connected') { super(code); }
}
