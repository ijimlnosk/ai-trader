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

it('colors and signs profit/loss from exact strings', async () => {
  const { toneOf, formatSignedKrw, formatRelative } = await import('./format');
  expect(toneOf('9125')).toBe('up'); expect(toneOf('-605')).toBe('down'); expect(toneOf('0.00')).toBe('flat'); expect(toneOf(null)).toBe('flat');
  expect(formatSignedKrw('9125')).toBe('+₩9,125'); expect(formatSignedKrw('-605')).toBe('-₩605'); expect(formatSignedKrw('0')).toBe('₩0');
  const now = Date.parse('2026-09-30T01:00:00Z');
  expect(formatRelative('2026-09-30T00:59:40Z', now)).toBe('방금');
  expect(formatRelative('2026-09-30T00:57:00Z', now)).toBe('3분 전');
  expect(formatRelative('2026-09-29T23:00:00Z', now)).toBe('2시간 전');
  expect(formatRelative('2026-09-28T01:00:00Z', now)).toContain('KST');
  expect(formatRelative(null, now)).toBe('—');
});

it('formats compact dates, names and fills', async () => {
  const { formatShortDate, symbolName, formatFill } = await import('./format');
  expect(formatShortDate('20260929')).toBe('9/29'); expect(formatShortDate('20261005')).toBe('10/5'); expect(formatShortDate('x')).toBe('—');
  expect(symbolName('005930')).toBe('삼성전자'); expect(symbolName('000660')).toBe('000660');
  expect(formatFill('1.00000000', '1')).toBe('1주'); expect(formatFill('1', '2')).toBe('1/2주');
});
