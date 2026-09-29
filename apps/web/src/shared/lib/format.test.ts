import { expect, it } from 'vitest';
import { formatDecimal, formatKrw, formatSeoulTime, formatSessionDate } from './format';

it('groups exact decimal strings without float conversion', () => {
  expect(formatDecimal('9007199254740993')).toBe('9,007,199,254,740,993');
  expect(formatDecimal('-9125')).toBe('-9,125');
  expect(formatDecimal('272500.00000000')).toBe('272,500');
  expect(formatDecimal('263375.5000')).toBe('263,375.5');
  expect(formatDecimal('1e5')).toBe('—');
  expect(formatDecimal(null)).toBe('—');
  expect(formatKrw('272500')).toBe('₩272,500');
  expect(formatKrw('bad')).toBe('—');
});

it('renders instants and sessions in Seoul terms', () => {
  expect(formatSeoulTime('2026-09-29T03:41:42.108Z')).toContain('12:41:42');
  expect(formatSeoulTime('2026-09-29T03:41:42.108Z')).toContain('KST');
  expect(formatSeoulTime('nope')).toBe('—');
  expect(formatSessionDate('20260929')).toBe('2026-09-29');
  expect(formatSessionDate('2026')).toBe('—');
});
