import { expect, it } from 'vitest';
import { authSetup } from '../../../test/authSetup.ts';
import { sessionResponse } from './index.ts';

it('normalizes email, stores only token digest and revokes sessions', async () => {
  const s = authSetup();
  const login = await s.auth.login({ ...s.credentials, email: ' OWNER@EXAMPLE.TEST ' });
  expect(login.token).toMatch(/^[a-f0-9]{64}$/);
  expect(s.sessions.has(login.token)).toBe(false);
  expect(await s.auth.authenticate(login.token)).toMatchObject(s.identity);
  await s.auth.logout(login.token);
  await expect(s.auth.authenticate(login.token)).rejects.toMatchObject({ code: 'unauthorized' });
});
it('unknown, disabled and incorrect passwords use the same response and verification work', async () => {
  const s = authSetup();
  for (const input of [{ ...s.credentials, email: 'unknown@example.test' }, { ...s.credentials, password: 'wrong' }]) {
    await expect(s.auth.login(input)).rejects.toMatchObject({ code: 'unauthorized' });
  }
  s.user.disabled = true;
  await expect(s.auth.login(s.credentials)).rejects.toMatchObject({ code: 'unauthorized' });
  expect(s.passwords.verify).toHaveBeenCalledTimes(3); expect(s.sessions.size).toBe(0);
});
it('rejects expired, forged and missing sessions', async () => {
  const s = authSetup(); const { token } = await s.auth.login(s.credentials);
  for (const identity of s.sessions.values()) identity.expiresAt = '2000-01-01T00:00:00Z';
  for (const value of [token, 'b'.repeat(64), '', undefined]) {
    await expect(s.auth.authenticate(value)).rejects.toMatchObject({ code: 'unauthorized' });
  }
});
it('rate limits before expensive work and rejects credentials invalidated during login', async () => {
  const s = authSetup(); s.repository.consumeAttempt.mockResolvedValueOnce(false);
  await expect(s.auth.login(s.credentials)).rejects.toMatchObject({ code: 'login_rate_limited' });
  expect(s.passwords.verify).not.toHaveBeenCalled();
  s.repository.createSession.mockResolvedValueOnce(false);
  await expect(s.auth.login(s.credentials)).rejects.toMatchObject({ code: 'unauthorized' });
});
it('does not serialize internal account or password fields', () => {
  const s = authSetup();
  expect(sessionResponse({ ...s.identity, expiresAt: 'expiry' }, 'other')).toEqual({ user: { id: 'u1', email: s.user.email, hasTradingAccount: false }, expiresAt: 'expiry' });
});
