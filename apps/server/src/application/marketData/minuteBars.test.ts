import { describe, expect, it, vi } from 'vitest';
import { createMinuteBarCollector, type MinuteBar, type MinuteBarRecord } from './minuteBars.ts';
import { createMinuteBarSchedule } from './minuteSchedule.ts';

const bar = (time: string): MinuteBar => ({ time, open: '100', high: '110', low: '90', close: '105', volume: '10' });
const timesBefore = (through: string, count: number) => {
  const end = Number(through.slice(0, 2)) * 60 + Number(through.slice(2, 4));
  return Array.from({ length: count }, (_, i) => end - i).filter((m) => m >= 9 * 60)
    .map((m) => `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}00`);
};
// 2026-10-01 is a KRX session; 15:45 KST.
const after = () => new Date('2026-10-01T06:45:00Z');

function setup(page = (through: string) => timesBefore(through, 30).map(bar), date = '20261001') {
  const saved: MinuteBarRecord[] = [];
  const source = { getMinuteBars: vi.fn(async (_symbol: string, through: string) => ({ date, bars: page(through), source: 'fixture', rawSha256: through })) };
  const repository = { exists: vi.fn(async () => false), save: vi.fn(async (record: MinuteBarRecord) => { saved.push(record); }) };
  return { source, repository, saved, collect: createMinuteBarCollector({ source, repository, now: after }) };
}

describe('minute bar collection', () => {
  it('pages back from the close to the open and saves the full session ascending, once', async () => {
    const s = setup();
    expect(await s.collect('005930')).toEqual({ status: 'saved', bars: 391, pages: 14 });
    expect(s.source.getMinuteBars.mock.calls.slice(0, 2).map(([, through]) => through)).toEqual(['153000', '150000']);
    const [record] = s.saved;
    expect(record).toMatchObject({ symbol: '005930', sessionDate: '20261001', source: 'fixture retrieved 2026-10-01T06:45:00.000Z' });
    expect(record!.bars[0]!.time).toBe('090000');
    expect(record!.bars.at(-1)!.time).toBe('153000');
    s.repository.exists.mockResolvedValue(true);
    expect(await s.collect('005930')).toEqual({ status: 'skipped', reason: 'already_saved' });
  });

  it('collects nothing before 15:40, on non-session days, or when the provider returns another day', async () => {
    const early = createMinuteBarCollector({ ...setup(), now: () => new Date('2026-10-01T06:30:00Z') });
    expect(await early('005930')).toEqual({ status: 'skipped', reason: 'too_early' });
    const holiday = createMinuteBarCollector({ ...setup(), now: () => new Date('2026-10-03T07:00:00Z') });
    expect(await holiday('005930')).toEqual({ status: 'skipped', reason: 'not_session' });
    const stale = setup(undefined, '20260930');
    expect(await stale.collect('005930')).toEqual({ status: 'skipped', reason: 'date_mismatch' });
    expect(stale.repository.save).not.toHaveBeenCalled();
  });

  it('skips empty and inconsistent data instead of saving it', async () => {
    expect(await setup(() => []).collect('005930')).toEqual({ status: 'skipped', reason: 'no_bars' });
    const broken = setup((through) => timesBefore(through, 30).map((time) => ({ ...bar(time), close: '120' })));
    expect(await broken.collect('005930')).toEqual({ status: 'skipped', reason: 'invalid_bars' });
    expect(broken.repository.save).not.toHaveBeenCalled();
  });
});

describe('minute bar schedule', () => {
  it('runs once per session after the close and retries only failed symbols', async () => {
    let at = new Date('2026-10-01T06:30:00Z');
    const collect = vi.fn(async (symbol: string) => {
      if (symbol === 'B' && collect.mock.calls.length <= 2) throw new Error('timeout');
      return { status: 'saved' as const, bars: 391, pages: 14 };
    });
    const report = vi.fn();
    const step = createMinuteBarSchedule({ collect, symbols: ['A', 'B'], report, now: () => at });
    await step();
    expect(collect).not.toHaveBeenCalled();
    at = new Date('2026-10-01T06:40:00Z');
    await step();
    expect(collect.mock.calls.map(([symbol]) => symbol)).toEqual(['A', 'B']);
    await step();
    expect(collect).toHaveBeenCalledTimes(2);
    at = new Date('2026-10-01T06:50:00Z');
    await step();
    expect(collect.mock.calls.map(([symbol]) => symbol)).toEqual(['A', 'B', 'B']);
    expect(report).toHaveBeenCalledWith('minute_bars_failed', { symbol: 'B', attempt: '1' });
  });
});
