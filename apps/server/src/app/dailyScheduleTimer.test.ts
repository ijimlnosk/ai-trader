import { afterEach, expect, it, vi } from 'vitest';
import { startDailyScheduleTimer } from './dailyScheduleTimer.ts';

afterEach(() => vi.useRealTimers());

it('never overlaps steps, survives a failed step and awaits in-flight work on stop', async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const step = vi.fn().mockRejectedValueOnce(new Error('private-secret')).mockImplementationOnce(() => gate).mockResolvedValue(undefined);
  const report = vi.fn();
  const stop = startDailyScheduleTimer(step, report, 10);
  await vi.advanceTimersByTimeAsync(100);
  expect(step).toHaveBeenCalledTimes(2);
  expect(report.mock.calls).toEqual([['daily_schedule_step_failed']]);
  const closing = stop(); release(); await closing;
  await vi.advanceTimersByTimeAsync(100);
  expect(step).toHaveBeenCalledTimes(2);
});
