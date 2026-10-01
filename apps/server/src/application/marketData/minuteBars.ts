import { createHash } from 'node:crypto';
import { seoulOrderDate } from '../../domain/orders.ts';
import { krxSessionStatus } from '../../domain/scheduler/krxCalendar.ts';

/** One regular-session minute bar; `time` is the provider's HHMMSS label in Asia/Seoul. Raw KRW, shares. */
export interface MinuteBar { time: string; open: string; high: string; low: string; close: string; volume: string }

export interface MinuteBarPage {
  /** Bars of `date` at or before the requested time, in any order. */
  date: string; bars: MinuteBar[];
  /** Human-readable provenance (provider and transaction). */
  source: string; rawSha256: string;
}

export interface MinuteBarSource {
  /** Up to one provider page of today's minute bars ending at `through` (HHMMSS, Asia/Seoul). */
  getMinuteBars(symbol: string, through: string): Promise<MinuteBarPage>;
}

export interface MinuteBarRecord {
  symbol: string; sessionDate: string; bars: MinuteBar[]; source: string; retrievedAt: string;
  /** SHA-256 over the raw page digests in request order. */
  rawSha256: string;
}

export interface MinuteBarRepository {
  exists(symbol: string, sessionDate: string): Promise<boolean>;
  /** Insert-only: an existing symbol/session row is kept. */
  save(record: MinuteBarRecord): Promise<void>;
}

/** 15:40 KST: after the 15:30 closing auction bar is published. */
export const MINUTE_COLLECT_START_MINUTE = 15 * 60 + 40;
const OPEN = '090000';
const CLOSE = '153000';
const MAX_PAGES = 20;

export type MinuteCollectResult =
  | { status: 'saved'; bars: number; pages: number }
  | { status: 'skipped'; reason: 'not_session' | 'too_early' | 'already_saved' | 'no_bars' | 'date_mismatch' | 'invalid_bars' };

const minuteBefore = (time: string) => {
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(2, 4)) - 1;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}00`;
};

/**
 * Archives today's regular-session minute bars once per symbol after the close. Data only:
 * nothing here feeds plans or orders. Partial or inconsistent pages are skipped, never padded.
 */
export function createMinuteBarCollector(deps: { source: MinuteBarSource; repository: MinuteBarRepository; now?: () => Date }) {
  const now = deps.now ?? (() => new Date());
  return async (symbol: string): Promise<MinuteCollectResult> => {
    const at = now();
    const today = seoulOrderDate(at.toISOString());
    const seoul = new Date(at.getTime() + 9 * 3600000);
    if (krxSessionStatus(today) !== 'session') return { status: 'skipped', reason: 'not_session' };
    if (seoul.getUTCHours() * 60 + seoul.getUTCMinutes() < MINUTE_COLLECT_START_MINUTE) return { status: 'skipped', reason: 'too_early' };
    if (await deps.repository.exists(symbol, today)) return { status: 'skipped', reason: 'already_saved' };
    const bars = new Map<string, MinuteBar>();
    const digests: string[] = [];
    let through = CLOSE;
    let pages = 0;
    let source = '';
    while (pages < MAX_PAGES && through >= OPEN) {
      const page = await deps.source.getMinuteBars(symbol, through);
      pages += 1;
      digests.push(page.rawSha256);
      source = page.source;
      if (page.bars.length === 0) break;
      if (page.date !== today) return { status: 'skipped', reason: 'date_mismatch' };
      for (const bar of page.bars) if (bar.time >= OPEN && bar.time <= CLOSE) bars.set(bar.time, bar);
      const earliest = page.bars.reduce((min, bar) => bar.time < min ? bar.time : min, page.bars[0]!.time);
      if (earliest <= OPEN || earliest > through) break;
      through = minuteBefore(earliest);
    }
    const sorted = [...bars.values()].sort((a, b) => a.time.localeCompare(b.time));
    if (sorted.length === 0) return { status: 'skipped', reason: 'no_bars' };
    if (sorted.some((bar) => BigInt(bar.low) > BigInt(bar.high) || BigInt(bar.close) > BigInt(bar.high) || BigInt(bar.close) < BigInt(bar.low))) {
      return { status: 'skipped', reason: 'invalid_bars' };
    }
    const retrievedAt = at.toISOString();
    await deps.repository.save({ symbol, sessionDate: today, bars: sorted, retrievedAt,
      source: `${source} retrieved ${retrievedAt}`,
      rawSha256: createHash('sha256').update(digests.join(',')).digest('hex') });
    return { status: 'saved', bars: sorted.length, pages };
  };
}
export type MinuteBarCollector = ReturnType<typeof createMinuteBarCollector>;
