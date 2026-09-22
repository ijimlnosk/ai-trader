import { expect, it } from 'vitest';
import { explicitSessionCalendar, isSeoulTradingSession } from './session.ts';

it('requires an explicit calendar date', () => {
  const calendar = explicitSessionCalendar(['20260922']);
  expect(isSeoulTradingSession(new Date('2026-09-22T01:00:00.000Z'), calendar)).toBe(true);
  expect(isSeoulTradingSession(new Date('2026-09-23T01:00:00.000Z'), calendar)).toBe(false);
});
