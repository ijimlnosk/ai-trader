import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordVerifier } from '../../application/auth/ports.ts';
import { newPasswordSchema } from '../../application/auth/index.ts';

// OWASP scrypt profile: N=2^17, r=8, p=1. No synchronous KDF on the request thread.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, Buffer.from(salt, 'hex'), 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(raw: string): Promise<string> {
  const password = newPasswordSchema.parse(raw);
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString('hex')}`;
}
export const passwordVerifier: PasswordVerifier = {
  async verify(password, hash) {
    const parts = /^scrypt-v1:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash ?? '');
    const key = await derive(password, parts?.[1] ?? '00'.repeat(16));
    const expected = Buffer.from(parts?.[2] ?? '00'.repeat(64), 'hex');
    return timingSafeEqual(key, expected) && parts !== null;
  },
};
