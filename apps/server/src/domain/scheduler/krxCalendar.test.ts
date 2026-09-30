import { describe, expect, it } from 'vitest';
import { KRX_CALENDAR, krxSessionCalendar, krxSessionStatus, krxSessionsBetween, nextKrxSession, previousKrxSession } from './krxCalendar.ts';

describe('KRX calendar', () => {
  it('classifies sessions, weekends and every listed closure', () => {
    expect(krxSessionStatus('20260929')).toBe('session');
    expect(krxSessionStatus('20260926')).toBe('closed');
    expect(krxSessionStatus('20260927')).toBe('closed');
    for (const date of KRX_CALENDAR.closures) expect(krxSessionStatus(date)).toBe('closed');
    expect(krxSessionCalendar.has('20260929')).toBe(true);
    expect(krxSessionCalendar.has('20261005')).toBe(false);
  });

  it('treats coverage boundaries, uncovered and invalid dates as unknown', () => {
    expect(krxSessionStatus(KRX_CALENDAR.from)).toBe('session');
    expect(krxSessionStatus('20260429')).toBe('unknown');
    expect(krxSessionStatus(KRX_CALENDAR.through)).toBe('session');
    expect(krxSessionStatus('20261231')).toBe('unknown');
    expect(krxSessionStatus('20260230')).toBe('unknown');
    expect(krxSessionStatus('2026-09-29')).toBe('unknown');
    expect(krxSessionCalendar.has('20261231')).toBe(false);
  });

  it('finds the next session across weekends and closures', () => {
    expect(nextKrxSession('20260928')).toBe('20260929');
    expect(nextKrxSession('20260923')).toBe('20260928');
    expect(nextKrxSession('20261002')).toBe('20261006');
    expect(nextKrxSession('20261008')).toBe('20261012');
    expect(nextKrxSession('20261224')).toBe('20261228');
  });

  it('finds the previous session across weekends and closures', () => {
    expect(previousKrxSession('20260929')).toBe('20260928');
    expect(previousKrxSession('20260928')).toBe('20260923');
    expect(previousKrxSession('20261006')).toBe('20261002');
    expect(previousKrxSession('20261012')).toBe('20261008');
  });

  it('returns null rather than guessing beyond coverage', () => {
    expect(nextKrxSession('20261230')).toBeNull();
    expect(previousKrxSession('20260430')).toBeNull();
    expect(previousKrxSession('20270104')).toBeNull();
    expect(nextKrxSession('bad')).toBeNull();
  });

  it('lists sessions only for fully covered ranges', () => {
    expect(krxSessionsBetween('20260922', '20260930')).toEqual(['20260922', '20260923', '20260928', '20260929', '20260930']);
    expect(krxSessionsBetween('20260420', '20260505')).toBeNull();
    expect(krxSessionsBetween('20261201', '20261231')).toBeNull();
    expect(krxSessionsBetween('20260930', '20260922')).toBeNull();
  });

  it('matches the 100 independently checked sessions from 2026-04-30 to 2026-09-28', () => {
    expect(krxSessionsBetween('20260430', '20260928')).toHaveLength(100);
  });
});

describe('krxSessionsElapsed', () => {
  it('counts reviewed sessions after the start, across closures', async () => {
    const { krxSessionsElapsed } = await import('./krxCalendar.ts');
    expect(krxSessionsElapsed('20260923', '20260928')).toBe(1);
    expect(krxSessionsElapsed('20261002', '20261012')).toBe(4); // 10/6, 10/7, 10/8, 10/12
    expect(krxSessionsElapsed('20260929', '20260929')).toBe(0);
    expect(krxSessionsElapsed('20260930', '20260929')).toBe(0);
    expect(krxSessionsElapsed('20261228', '20261231')).toBeNull();
    expect(krxSessionsElapsed('bad', '20260929')).toBeNull();
  });
});
