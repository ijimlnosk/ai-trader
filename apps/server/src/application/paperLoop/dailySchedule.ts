import { seoulOrderDate } from '../../domain/orders.ts';
import { krxSessionStatus } from '../../domain/scheduler/krxCalendar.ts';
import { completedSessionAt, type DailySnapshotCollector } from '../marketData/collect.ts';
import type { PaperLoop } from './index.ts';
import type { PaperLoopInput } from './input.ts';
import { PaperLoopError } from './ports.ts';
import type { PaperLoopPreparer } from './prepare.ts';

const TICK_START_MINUTE = 9 * 60 + 5;
const TICK_END_MINUTE = 15 * 60;
const MAX_COLLECT_ATTEMPTS = 3;
const COLLECT_RETRY_MS = 10 * 60000;

export type ScheduleReport = (event: string, detail?: Record<string, string>) => void;

const seoulMinute = (now: Date) => {
  const seoul = new Date(now.getTime() + 9 * 3600000);
  return seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
};

/**
 * One step of the daily paper schedule. State is in memory only: after a restart, repeated
 * collection is idempotent and a repeated tick replays the durable loop claim instead of trading.
 * There is no catch-up; a missed window is skipped. Any halt stops ticks until restart.
 */
export function createDailySchedule(deps: {
  collect?: DailySnapshotCollector | undefined;
  loop?: { prepare: PaperLoopPreparer; tick: PaperLoop } | undefined;
  report: ScheduleReport; now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  const state = { collectDate: '', collectAttempts: 0, collectDone: false, nextCollectAt: 0,
    tickDate: '', tracking: null as PaperLoopInput | null, halted: false };

  async function collectStep(at: Date, today: string) {
    if (!deps.collect || completedSessionAt(at) !== today) return;
    if (state.collectDate !== today) Object.assign(state, { collectDate: today, collectAttempts: 0, collectDone: false, nextCollectAt: 0 });
    if (state.collectDone || state.collectAttempts >= MAX_COLLECT_ATTEMPTS || at.getTime() < state.nextCollectAt) return;
    state.collectAttempts += 1;
    state.nextCollectAt = at.getTime() + COLLECT_RETRY_MS;
    try {
      const result = await deps.collect('005930');
      if (result.status === 'skipped') return deps.report('market_snapshot_skipped', { reason: result.reason });
      state.collectDone = true;
      deps.report(`market_snapshot_${result.status}`, { through: result.snapshot.through,
        revisedDates: result.snapshot.revisedDates.join(',') });
    } catch { deps.report('market_snapshot_failed', { attempt: String(state.collectAttempts) }); }
  }

  async function runTick(input: PaperLoopInput) {
    try {
      const run = await deps.loop!.tick(input);
      deps.report(`paper_loop_${run.status.toLowerCase()}`, { runKey: input.runKey });
      state.tracking = run.status === 'TRACKING' ? input : null;
      if (run.status === 'HALTED' || run.status === 'CLAIMED') state.halted = true;
    } catch (error) {
      state.tracking = null;
      const code = error instanceof PaperLoopError ? error.code : 'loop_unavailable';
      // A pre-claim admission refusal skips the day; anything else needs an operator.
      if (code !== 'loop_context_unavailable') state.halted = true;
      deps.report(state.halted ? 'paper_loop_schedule_halted' : 'paper_loop_skipped', { reason: code });
    }
  }

  async function tickStep(at: Date, today: string) {
    if (!deps.loop || state.halted) return;
    if (state.tracking) return runTick(state.tracking);
    const minute = seoulMinute(at);
    if (state.tickDate === today || krxSessionStatus(today) !== 'session'
      || minute < TICK_START_MINUTE || minute >= TICK_END_MINUTE) return;
    state.tickDate = today;
    const prepared = await deps.loop.prepare().catch(() => null);
    if (!prepared) return deps.report('paper_loop_skipped', { reason: 'prepare_failed' });
    if (prepared.status === 'skipped') return deps.report('paper_loop_skipped', { reason: prepared.reason });
    return runTick(prepared.input);
  }

  return async () => {
    const at = now();
    const today = seoulOrderDate(at.toISOString());
    await collectStep(at, today);
    await tickStep(at, today);
  };
}
export type DailyScheduleStep = ReturnType<typeof createDailySchedule>;
