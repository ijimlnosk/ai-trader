import { seoulOrderDate } from '../../domain/orders.ts';
import { krxSessionStatus } from '../../domain/scheduler/krxCalendar.ts';
import { MINUTE_COLLECT_START_MINUTE, type MinuteBarCollector } from './minuteBars.ts';

/** The provider serves only the current day's minute bars, so collection must finish the same evening. */
const MINUTE_COLLECT_END_MINUTE = 23 * 60;
const MAX_ATTEMPTS = 3;
const RETRY_MS = 10 * 60000;

/**
 * Once per session day after the close, archives minute bars for each symbol; only symbols that
 * failed are retried, up to three attempts. In-memory state: after a restart, saved rows are skipped.
 */
export function createMinuteBarSchedule(deps: { collect: MinuteBarCollector; symbols: readonly string[];
  report: (event: string, detail?: Record<string, string>) => void; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  const state = { date: '', pending: [] as string[], attempts: 0, nextAt: 0 };
  return async () => {
    const at = now();
    const today = seoulOrderDate(at.toISOString());
    const seoul = new Date(at.getTime() + 9 * 3600000);
    const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
    if (krxSessionStatus(today) !== 'session' || minute < MINUTE_COLLECT_START_MINUTE || minute >= MINUTE_COLLECT_END_MINUTE) return;
    if (state.date !== today) Object.assign(state, { date: today, pending: [...deps.symbols], attempts: 0, nextAt: 0 });
    if (state.pending.length === 0 || state.attempts >= MAX_ATTEMPTS || at.getTime() < state.nextAt) return;
    state.attempts += 1;
    state.nextAt = at.getTime() + RETRY_MS;
    let saved = 0; let skipped = 0;
    for (const symbol of [...state.pending]) {
      try {
        const result = await deps.collect(symbol);
        state.pending = state.pending.filter((pending) => pending !== symbol);
        if (result.status === 'saved') saved += 1;
        else { skipped += 1; if (result.reason !== 'already_saved') deps.report('minute_bars_skipped', { symbol, reason: result.reason }); }
      } catch { deps.report('minute_bars_failed', { symbol, attempt: String(state.attempts) }); }
    }
    deps.report('minute_bars_collected', { saved: String(saved), skipped: String(skipped), pending: String(state.pending.length),
      attempt: String(state.attempts) });
  };
}
