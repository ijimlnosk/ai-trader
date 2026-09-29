import type { DailyHistory, DailyHistorySource, DailySnapshot, DailySnapshotRepository } from '../src/application/marketData/ports.ts';
import type { DailyCandle } from '../src/domain/strategy/marketData.ts';

export const bar = (date: string, volume = '1000'): DailyCandle =>
  ({ date, open: '270000', high: '272000', low: '268000', close: '271000', volume });

export function stubHistory(candles: DailyCandle[], retrievedAt = '2026-09-29T00:00:00.000Z'): DailyHistorySource & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    async getDailyHistory(symbol, from, through): Promise<DailyHistory> {
      calls.push([symbol, from, through]);
      return { candles, retrievedAt, source: `fixture retrieved ${retrievedAt}`, rawSha256: 'a'.repeat(64) };
    },
  };
}

export function createMemorySnapshotRepository(): DailySnapshotRepository & { rows: DailySnapshot[] } {
  const rows: DailySnapshot[] = [];
  const newest = (list: DailySnapshot[]) => list.at(-1) ?? null;
  return {
    rows,
    latest: async (symbol) => newest(rows.filter((row) => row.symbol === symbol)),
    latestThrough: async (symbol, through) => newest(rows.filter((row) => row.symbol === symbol && row.through === through)),
    async save(snapshot) {
      const existing = rows.find((row) => row.symbol === snapshot.symbol && row.through === snapshot.through
        && row.candlesSha256 === snapshot.candlesSha256);
      if (existing) return { snapshot: existing, created: false };
      const saved = { ...snapshot, id: `snapshot-${rows.length + 1}` };
      rows.push(saved);
      return { snapshot: saved, created: true };
    },
  };
}
