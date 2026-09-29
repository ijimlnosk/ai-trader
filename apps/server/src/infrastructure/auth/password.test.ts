import { expect, it } from 'vitest';
import { hashPassword, passwordVerifier } from './password.ts';
it('salts password hashes and rejects incorrect or malformed credentials', async () => {
  const password = 'test-password-at-least-15';
  const first = await hashPassword(password); const second = await hashPassword(password);
  expect(first).not.toBe(second); expect(first).not.toContain(password);
  expect(await passwordVerifier.verify(password, first)).toBe(true);
  expect(await passwordVerifier.verify('wrong', first)).toBe(false);
  expect(await passwordVerifier.verify(password, null)).toBe(false);
  expect(await passwordVerifier.verify(password, 'malformed')).toBe(false);
  await expect(hashPassword('short')).rejects.toThrow();
}, 10000);
