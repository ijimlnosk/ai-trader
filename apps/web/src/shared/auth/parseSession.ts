import type { ConsoleSessionResponse } from '@ai-trader/contracts';

export function parseSession(raw: unknown): ConsoleSessionResponse {
  if (!raw || typeof raw !== 'object' || !('user' in raw) || !raw.user || typeof raw.user !== 'object'
    || !('id' in raw.user) || typeof raw.user.id !== 'string' || !('email' in raw.user) || typeof raw.user.email !== 'string'
    || !('hasTradingAccount' in raw.user) || typeof raw.user.hasTradingAccount !== 'boolean'
    || !('expiresAt' in raw) || typeof raw.expiresAt !== 'string' || !Number.isFinite(Date.parse(raw.expiresAt))) {
    throw new Error('Invalid session response');
  }
  return { user: { id: raw.user.id, email: raw.user.email, hasTradingAccount: raw.user.hasTradingAccount }, expiresAt: raw.expiresAt };
}
