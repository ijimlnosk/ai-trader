import type { DailyScheduleStep } from '../application/paperLoop/dailySchedule.ts';

/** Self-scheduling, never-overlapping timer for the daily schedule; stop awaits in-flight work. */
export function startDailyScheduleTimer(step: DailyScheduleStep, report: (event: string) => void, intervalMs = 30000) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  const run = async () => {
    try { await step(); } catch { report('daily_schedule_step_failed'); }
    if (!stopped) { timer = setTimeout(() => { running = run(); }, intervalMs); timer.unref(); }
  };
  timer = setTimeout(() => { running = run(); }, 0); timer.unref();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await running; };
}
