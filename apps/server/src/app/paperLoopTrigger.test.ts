import { afterEach, expect, it, vi } from 'vitest';
import { paperLoopSetup } from '../../test/paperLoopSetup.ts';
import { startPaperLoopTrigger } from './paperLoopTrigger.ts';
import { loopOrderKey } from '../application/paperLoop/input.ts';

afterEach(() => vi.useRealTimers());
it('does not overlap work, stops at terminal state, and awaits in-flight work on shutdown', async () => {
  vi.useFakeTimers();
  const s = paperLoopSetup();
  const { run } = await s.repo.claim(s.input, loopOrderKey(s.input), '2026-09-16T01:02:00Z');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const tick = vi.fn(async () => { await gate; return { ...run, status: 'COMPLETE' as const }; });
  const report = vi.fn(); const stop = startPaperLoopTrigger(tick, s.input, report, 10);
  await vi.advanceTimersByTimeAsync(100);
  expect(tick).toHaveBeenCalledTimes(1);
  const closing = stop(); release(); await closing;
  await vi.advanceTimersByTimeAsync(100);
  expect(tick).toHaveBeenCalledTimes(1); expect(report).toHaveBeenCalledWith('paper_loop_complete');
});
it('polls tracking with bounded cadence and stops on errors without logging secrets', async () => {
  vi.useFakeTimers(); const s = paperLoopSetup();
  const { run } = await s.repo.claim(s.input, loopOrderKey(s.input), '2026-09-16T01:02:00Z');
  const tick = vi.fn().mockResolvedValueOnce({ ...run, status: 'TRACKING' }).mockRejectedValue(new Error('private-secret'));
  const report = vi.fn(); const stop = startPaperLoopTrigger(tick, s.input, report, 10);
  await vi.advanceTimersByTimeAsync(100);
  expect(tick).toHaveBeenCalledTimes(2); expect(report.mock.calls).toEqual([['paper_loop_tracking'], ['paper_loop_tick_failed']]);
  await stop();
});
