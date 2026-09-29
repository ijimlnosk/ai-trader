import { expect, it } from 'vitest';
import { allowedOrigin, sessionCookie } from './policy';
import { readLoginBody } from './readLoginBody';
import { parseSession } from './parseSession';
it('rejects cross-site, missing and malformed origins regardless of cookies', () => {
  for (const origin of [null, 'null', 'https://evil.test', 'https://trader.jjinsol.com.evil.test', 'http://trader.jjinsol.com']) {
    expect(allowedOrigin(origin, 'https://trader.jjinsol.com')).toBe(false);
  }
  expect(allowedOrigin('https://trader.jjinsol.com', undefined)).toBe(false);
  expect(allowedOrigin('https://trader.jjinsol.com', 'https://trader.jjinsol.com')).toBe(true);
  expect(sessionCookie(true)).toBe('__Host-trader_session');
});
it('bounds login request bytes before collecting an unbounded body', async () => {
  expect(await readLoginBody(new Request('http://local', { method: 'POST', body: '가'.repeat(2000) }))).toBeNull();
  expect(await readLoginBody(new Request('http://local', { method: 'POST', body: '{"email":"a"}' }))).toBe('{"email":"a"}');
});
it('validates session boundary and strips internal fields', () => {
  const input = { user: { id: 'u', email: 'user@example.test', hasTradingAccount: false, passwordHash: 'private' }, expiresAt: '2026-09-30T00:00:00Z' };
  expect(JSON.stringify(parseSession(input))).not.toContain('private');
  expect(() => parseSession({ ...input, user: { ...input.user, hasTradingAccount: 'true' } })).toThrow();
});
