import type { PaperLoop } from '../application/paperLoop/index.ts';
import type { PaperLoopInput } from '../application/paperLoop/input.ts';

/** One fixed archived task per process; no queue, catch-up, resubmission, or overlapping callbacks. */
export function startPaperLoopTrigger(tick: PaperLoop, input: PaperLoopInput,
  report: (event: string) => void, intervalMs = 30000) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  const step = async () => {
    try {
      const run = await tick(input);
      report(`paper_loop_${run.status.toLowerCase()}`);
      if (run.status === 'COMPLETE' || run.status === 'HALTED' || run.status === 'CLAIMED') stopped = true;
    } catch { report('paper_loop_tick_failed'); stopped = true; }
    if (!stopped) { timer = setTimeout(() => { running = step(); }, intervalMs); timer.unref(); }
  };
  // No automatic repeated admission attempts; start only during the declared session.
  timer = setTimeout(() => { running = step(); }, 0); timer.unref();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await running; };
}
