import { describe, expect, it } from 'vitest';
import { bar, createMemorySnapshotRepository, stubHistory } from '../../../test/marketDataFixtures.ts';
import { completedSessionAt, createDailySnapshotCollector } from './collect.ts';

const at = (iso: string) => () => new Date(iso);
const week = [bar('20260922'), bar('20260923'), bar('20260928')];

describe('completedSessionAt', () => {
  it('uses today only after 18:30 Seoul on a session', () => {
    expect(completedSessionAt(new Date('2026-09-29T09:29:00.000Z'))).toBe('20260928');
    expect(completedSessionAt(new Date('2026-09-29T09:30:00.000Z'))).toBe('20260929');
    expect(completedSessionAt(new Date('2026-09-26T12:00:00.000Z'))).toBe('20260923');
    expect(completedSessionAt(new Date('2026-10-05T12:00:00.000Z'))).toBe('20261002');
    expect(completedSessionAt(new Date('2027-01-05T12:00:00.000Z'))).toBeNull();
  });
});

describe('daily snapshot collector', () => {
  it('archives a calendar-aligned dataset through the last completed session', async () => {
    const history = stubHistory(week);
    const snapshots = createMemorySnapshotRepository();
    const result = await createDailySnapshotCollector({ history, snapshots, now: at('2026-09-29T00:00:00.000Z') })('005930');
    expect(history.calls).toEqual([['005930', '20260430', '20260928']]);
    expect(result).toMatchObject({ status: 'saved', snapshot: { symbol: '005930', through: '20260928',
      calendarVersion: 'krx-2026-v1', rawSha256: 'a'.repeat(64), revisedDates: [] } });
    if (result.status !== 'saved') throw new Error('expected saved');
    expect(result.snapshot.dataset).toEqual({ source: 'fixture retrieved 2026-09-29T00:00:00.000Z', timezone: 'Asia/Seoul',
      priceBasis: 'raw', sessions: ['20260922', '20260923', '20260928'], series: [{ symbol: '005930', candles: week }] });
    expect(result.snapshot.datasetSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is idempotent for identical bars even when retrieval time differs', async () => {
    const snapshots = createMemorySnapshotRepository();
    const now = at('2026-09-29T00:00:00.000Z');
    await createDailySnapshotCollector({ history: stubHistory(week), snapshots, now })('005930');
    const again = await createDailySnapshotCollector({ history: stubHistory(week, '2026-09-29T01:00:00.000Z'), snapshots, now })('005930');
    expect(again.status).toBe('unchanged');
    expect(snapshots.rows).toHaveLength(1);
    expect(again.status === 'unchanged' && again.snapshot.confirmedAt).toBe('2026-09-29T01:00:00.000Z');
  });

  it('records provider revisions of earlier bars instead of hiding them', async () => {
    const snapshots = createMemorySnapshotRepository();
    const now = at('2026-09-29T00:00:00.000Z');
    await createDailySnapshotCollector({ history: stubHistory(week), snapshots, now })('005930');
    const revised = [bar('20260922'), bar('20260923', '2000'), bar('20260928')];
    const result = await createDailySnapshotCollector({ history: stubHistory(revised), snapshots, now })('005930');
    expect(result).toMatchObject({ status: 'saved', snapshot: { revisedDates: ['20260923'] } });
    expect(snapshots.rows).toHaveLength(2);
  });

  it.each([
    ['latest bar missing', [bar('20260922'), bar('20260923')], 'bar_missing'],
    ['no bars', [], 'bar_missing'],
    ['session gap', [bar('20260922'), bar('20260928')], 'calendar_mismatch'],
    ['closure bar', [bar('20260923'), bar('20260924'), bar('20260928')], 'calendar_mismatch'],
    ['bar before coverage', [bar('20260429'), bar('20260430')], 'bar_missing'],
  ])('skips without saving when %s', async (_name, candles, reason) => {
    const snapshots = createMemorySnapshotRepository();
    const result = await createDailySnapshotCollector({ history: stubHistory(candles), snapshots, now: at('2026-09-29T00:00:00.000Z') })('005930');
    expect(result).toEqual({ status: 'skipped', reason });
    expect(snapshots.rows).toHaveLength(0);
  });

  it('skips before any request when the calendar cannot identify the session', async () => {
    const history = stubHistory(week);
    const result = await createDailySnapshotCollector({ history, snapshots: createMemorySnapshotRepository(),
      now: at('2027-01-05T12:00:00.000Z') })('005930');
    expect(result).toEqual({ status: 'skipped', reason: 'calendar_unknown' });
    expect(history.calls).toHaveLength(0);
  });

  it('propagates provider failures without saving', async () => {
    const snapshots = createMemorySnapshotRepository();
    const history = { getDailyHistory: async () => { throw new Error('provider_unavailable'); } };
    await expect(createDailySnapshotCollector({ history, snapshots, now: at('2026-09-29T00:00:00.000Z') })('005930')).rejects.toThrow();
    expect(snapshots.rows).toHaveLength(0);
  });
});
