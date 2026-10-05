import { timingSafeEqual } from 'node:crypto';

/** Constant-time check of `Authorization: Bearer <token>` for operator and service tokens. */
export function hasBearerToken(header: string | undefined, token: string): boolean {
  const supplied = Buffer.from(header ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
