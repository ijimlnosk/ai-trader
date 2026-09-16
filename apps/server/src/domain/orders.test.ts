import { expect, it } from 'vitest';
import { isPaperOrderSession, seoulOrderDate } from './orders.ts';

it.each([
  ['2026-09-15T23:59:59Z', false], ['2026-09-16T00:00:00Z', true],
  ['2026-09-16T06:19:59Z', true], ['2026-09-16T06:20:00Z', false],
  ['2026-09-19T01:00:00Z', false], ['2026-09-20T01:00:00Z', false],
])('KRX continuous market window %s: %s', (timestamp, expected) => {
  expect(isPaperOrderSession(new Date(timestamp))).toBe(expected);
});
it('broker dates use Asia/Seoul rather than UTC dates', () => {
  expect(seoulOrderDate('2026-09-15T15:00:00.000Z')).toBe('20260916');
});
