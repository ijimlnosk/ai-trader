import { seoulOrderDate } from '../orders.ts';

export interface TradingSessionCalendar {
  has(date: string): boolean;
}

export function explicitSessionCalendar(sessions: readonly string[]): TradingSessionCalendar {
  const dates = new Set(sessions);
  for (const date of sessions) if (!/^\d{8}$/.test(date)) throw new Error('Invalid session calendar');
  return { has: (date) => dates.has(date) };
}

/** The scheduler only runs inside the configured regular Seoul session. */
export function isSeoulTradingSession(now: Date, calendar: TradingSessionCalendar): boolean {
  const seoul = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
  return minute >= 540 && minute < 920 && calendar.has(seoulOrderDate(now.toISOString()));
}
