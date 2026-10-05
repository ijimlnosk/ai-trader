import { validTradeDate } from '../tradeLedger.ts';
import type { TradingSessionCalendar } from './session.ts';

export type KrxSessionStatus = 'session' | 'closed' | 'unknown';

/**
 * Reviewed KRX regular-session calendar. Dates outside coverage are unknown and must skip.
 * Update by adding source-cited closures and bumping the version; never infer from weekdays alone.
 */
export const KRX_CALENDAR = {
  version: 'krx-2026-v2',
  from: '20260102',
  // 2026-12-31 year-end closure not yet confirmed by a 2026 source; leave it unknown.
  through: '20261230',
  closures: [
    '20260216', '20260217', '20260218', '20260302',
    '20260501', '20260505', '20260525', '20260603', '20260717', '20260817',
    '20260924', '20260925', '20261005', '20261009', '20261225',
  ],
  sources: [
    'docs/SCHEDULER_PREP_2026-09-28.md (Mirae Asset 2026 calendar; Samsung Securities notices)',
    'https://kr.investing.com/holiday-calendar/ (2026-10-05, 2026-10-09, 2026-12-25; checked 2026-09-29)',
    'v2 (2026-10-05): 2026-01-02..04-29 weekday closures equal the dates absent from KIS FHKST03010100 bars of all 53 symbols in backtest-20260930/dataset3y.json',
  ],
} as const;

const closures: ReadonlySet<string> = new Set(KRX_CALENDAR.closures);

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10).replaceAll('-', '');
}

export function krxSessionStatus(date: string): KrxSessionStatus {
  if (!validTradeDate(date) || date < KRX_CALENDAR.from || date > KRX_CALENDAR.through) return 'unknown';
  const weekday = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 || weekday === 6 || closures.has(date) ? 'closed' : 'session';
}

function adjacentSession(date: string, step: 1 | -1): string | null {
  if (!validTradeDate(date)) return null;
  for (let day = shiftDate(date, step); ; day = shiftDate(day, step)) {
    const status = krxSessionStatus(day);
    if (status === 'unknown') return null;
    if (status === 'session') return day;
  }
}

/** The first session strictly after `date`, or null when any intervening day is unknown. */
export const nextKrxSession = (date: string): string | null => adjacentSession(date, 1);
/** The last session strictly before `date`, or null when any intervening day is unknown. */
export const previousKrxSession = (date: string): string | null => adjacentSession(date, -1);

/** All sessions in [from, through], or null unless the whole range is covered. */
export function krxSessionsBetween(from: string, through: string): string[] | null {
  if (krxSessionStatus(from) === 'unknown' || krxSessionStatus(through) === 'unknown' || from > through) return null;
  const sessions: string[] = [];
  for (let day = from; day <= through; day = shiftDate(day, 1)) {
    if (krxSessionStatus(day) === 'session') sessions.push(day);
  }
  return sessions;
}

export const krxSessionCalendar: TradingSessionCalendar = { has: (date) => krxSessionStatus(date) === 'session' };

/** Reviewed sessions strictly after `from` up to and including `to`; null when any day is uncovered. */
export function krxSessionsElapsed(from: string, to: string): number | null {
  if (!validTradeDate(from) || !validTradeDate(to)) return null;
  if (to <= from) return 0;
  const sessions = krxSessionsBetween(shiftDate(from, 1), to);
  return sessions ? sessions.length : null;
}
