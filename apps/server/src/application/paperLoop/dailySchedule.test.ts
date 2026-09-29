import { describe, expect, it, vi } from 'vitest';
import type { DailySnapshotCollector } from '../marketData/collect.ts';
import type { PaperLoop } from './index.ts';
import type { PaperLoopInput } from './input.ts';
import { PaperLoopError, type PaperLoopRun } from './ports.ts';
import type { PaperLoopPreparer } from './prepare.ts';
import { createDailySchedule } from './dailySchedule.ts';

const input = { runKey: 'loop-20260930-abc' } as PaperLoopInput;
const run = (status: PaperLoopRun['status']) => ({ status }) as PaperLoopRun;
const snapshot = { through: '20260929', revisedDates: [] as string[] };
const clock = (iso: string) => { const state = { now: new Date(iso) }; return { state, now: () => state.now }; };

function setup(iso: string) {
  const time = clock(iso);
  const report = vi.fn();
  const collect = vi.fn<DailySnapshotCollector>().mockResolvedValue({ status: 'saved', snapshot } as never);
  const prepare = vi.fn<PaperLoopPreparer>().mockResolvedValue({ status: 'ready', input });
  const tick = vi.fn<PaperLoop>().mockResolvedValue(run('COMPLETE'));
  const step = createDailySchedule({ collect, loop: { prepare, tick }, report, now: time.now });
  return { ...time, report, collect, prepare, tick, step };
}

describe('daily schedule collection', () => {
  it('collects once after 18:30 on a session and not before', async () => {
    const s = setup('2026-09-29T09:29:00Z');
    await s.step();
    expect(s.collect).not.toHaveBeenCalled();
    s.state.now = new Date('2026-09-29T09:30:00Z');
    await s.step(); await s.step();
    expect(s.collect).toHaveBeenCalledTimes(1);
    expect(s.report).toHaveBeenCalledWith('market_snapshot_saved', { through: '20260929', revisedDates: '' });
  });

  it('retries failures and skips at most three times, ten minutes apart', async () => {
    const s = setup('2026-09-29T09:30:00Z');
    s.collect.mockRejectedValue(new Error('provider_unavailable'));
    for (let minute = 0; minute < 60; minute += 1) {
      s.state.now = new Date(Date.parse('2026-09-29T09:30:00Z') + minute * 60000);
      await s.step();
    }
    expect(s.collect).toHaveBeenCalledTimes(3);
    expect(s.report).toHaveBeenLastCalledWith('market_snapshot_failed', { attempt: '3' });
  });

  it('does not collect on closures or dates outside the calendar', async () => {
    for (const iso of ['2026-10-05T10:00:00Z', '2026-09-27T10:00:00Z', '2026-12-31T10:00:00Z']) {
      const s = setup(iso);
      await s.step();
      expect(s.collect).not.toHaveBeenCalled();
    }
  });
});

describe('daily schedule ticks', () => {
  it('ticks once per session inside 09:05-15:00 Seoul', async () => {
    const s = setup('2026-09-30T00:04:00Z');
    await s.step();
    expect(s.tick).not.toHaveBeenCalled();
    s.state.now = new Date('2026-09-30T00:05:00Z');
    await s.step(); await s.step();
    expect(s.tick).toHaveBeenCalledTimes(1);
    expect(s.tick).toHaveBeenCalledWith(input);
    const late = setup('2026-09-30T06:00:00Z');
    await late.step();
    expect(late.tick).not.toHaveBeenCalled();
  });

  it('keeps ticking the same input while tracking, then stops', async () => {
    const s = setup('2026-09-30T00:05:00Z');
    s.tick.mockResolvedValueOnce(run('TRACKING')).mockResolvedValueOnce(run('TRACKING')).mockResolvedValueOnce(run('COMPLETE'));
    for (let i = 0; i < 5; i += 1) await s.step();
    expect(s.tick).toHaveBeenCalledTimes(3);
    expect(s.prepare).toHaveBeenCalledTimes(1);
  });

  it.each(['HALTED', 'CLAIMED'] as const)('halts all later ticks on %s', async (status) => {
    const s = setup('2026-09-30T00:05:00Z');
    s.tick.mockResolvedValue(run(status));
    await s.step();
    s.state.now = new Date('2026-10-01T00:05:00Z');
    await s.step();
    expect(s.tick).toHaveBeenCalledTimes(1);
  });

  it('skips the day on admission refusal but halts on other loop errors', async () => {
    const s = setup('2026-09-30T00:05:00Z');
    s.tick.mockRejectedValueOnce(new PaperLoopError('loop_context_unavailable'));
    await s.step();
    expect(s.report).toHaveBeenCalledWith('paper_loop_skipped', { reason: 'loop_context_unavailable' });
    s.state.now = new Date('2026-10-01T00:05:00Z');
    s.tick.mockRejectedValueOnce(new PaperLoopError('loop_busy'));
    await s.step();
    s.state.now = new Date('2026-10-02T00:05:00Z');
    await s.step();
    expect(s.tick).toHaveBeenCalledTimes(2);
    expect(s.report).toHaveBeenCalledWith('paper_loop_schedule_halted', { reason: 'loop_busy' });
  });

  it('skips without ticking when preparation is skipped or fails', async () => {
    const s = setup('2026-09-30T00:05:00Z');
    s.prepare.mockResolvedValueOnce({ status: 'skipped', reason: 'snapshot_missing' });
    await s.step();
    s.state.now = new Date('2026-10-01T00:05:00Z');
    s.prepare.mockRejectedValueOnce(new Error('db down'));
    await s.step();
    expect(s.tick).not.toHaveBeenCalled();
    expect(s.report.mock.calls).toEqual([['paper_loop_skipped', { reason: 'snapshot_missing' }], ['paper_loop_skipped', { reason: 'prepare_failed' }]]);
  });

  it('never ticks on closures and does not catch up missed days', async () => {
    const s = setup('2026-10-05T01:00:00Z');
    await s.step();
    expect(s.prepare).not.toHaveBeenCalled();
    s.state.now = new Date('2026-10-06T07:00:00Z');
    await s.step();
    expect(s.prepare).not.toHaveBeenCalled();
  });

  it('runs collection only when the loop is not composed', async () => {
    const report = vi.fn();
    const collect = vi.fn<DailySnapshotCollector>().mockResolvedValue({ status: 'unchanged', snapshot } as never);
    await createDailySchedule({ collect, report, now: () => new Date('2026-09-30T01:00:00Z') })();
    await createDailySchedule({ collect, report, now: () => new Date('2026-09-30T10:00:00Z') })();
    expect(collect).toHaveBeenCalledTimes(1);
  });
});
