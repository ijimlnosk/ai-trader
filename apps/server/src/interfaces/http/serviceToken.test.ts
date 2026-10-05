import { describe, expect, it } from 'vitest';
import { hasBearerToken } from './serviceToken.ts';

const token = 'x'.repeat(32);

describe('hasBearerToken', () => {
  it('accepts the exact bearer header', () => {
    expect(hasBearerToken(`Bearer ${token}`, token)).toBe(true);
  });

  it('rejects missing, wrong-scheme, shorter, longer and different tokens', () => {
    for (const header of [undefined, '', token, `bearer ${token}`, `Bearer ${token.slice(1)}`, `Bearer ${token}x`, `Bearer ${'y'.repeat(32)}`]) {
      expect(hasBearerToken(header, token)).toBe(false);
    }
  });
});
