import { seoulOrderDate } from '../../domain/orders.ts';
import { krxSessionStatus } from '../../domain/scheduler/krxCalendar.ts';
import type { DisclosureCollector } from './collect.ts';

// Before the 09:05 plan; disclosures filed overnight and over closures are listed by then.
const START_MINUTE = 8 * 60 + 15;
const END_MINUTE = 8 * 60 + 55;
const MAX_ATTEMPTS = 3;
const RETRY_MS = 10 * 60000;

/** Once per session morning; a failed run is retried up to three attempts, 10 minutes apart. */
export function createDisclosureSchedule(deps: { collect: DisclosureCollector;
  report: (event: string, detail?: Record<string, string>) => void; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  const state = { date: '', done: false, attempts: 0, nextAt: 0 };
  return async () => {
    const at = now();
    const today = seoulOrderDate(at.toISOString());
    const seoul = new Date(at.getTime() + 9 * 3600000);
    const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
    if (krxSessionStatus(today) !== 'session' || minute < START_MINUTE || minute >= END_MINUTE) return;
    if (state.date !== today) Object.assign(state, { date: today, done: false, attempts: 0, nextAt: 0 });
    if (state.done || state.attempts >= MAX_ATTEMPTS || at.getTime() < state.nextAt) return;
    state.attempts += 1;
    state.nextAt = at.getTime() + RETRY_MS;
    try {
      const result = await deps.collect();
      state.done = true;
      deps.report('disclosures_collected', { from: result.from, through: result.through, calls: String(result.calls),
        scanned: String(result.scanned), saved: String(result.saved), budgetExhausted: String(result.budgetExhausted) });
    } catch (error) {
      deps.report('disclosures_failed', { attempt: String(state.attempts), reason: error instanceof Error ? error.message.slice(0, 40) : 'unknown' });
    }
  };
}
