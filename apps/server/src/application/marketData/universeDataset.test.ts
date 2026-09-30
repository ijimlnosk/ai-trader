import { describe, expect, it } from 'vitest';
import { bar, createMemorySnapshotRepository } from '../../../test/marketDataFixtures.ts';
import { createUniverseDatasetBuilder } from './universeDataset.ts';

async function save(repo: ReturnType<typeof createMemorySnapshotRepository>, symbol: string, sessions: string[], collectedAt: string) {
  const dataset = { source: 's', timezone: 'Asia/Seoul' as const, priceBasis: 'raw' as const, sessions,
    series: [{ symbol, candles: sessions.map((date) => bar(date)) }] };
  await repo.save({ symbol, through: sessions.at(-1)!, collectedAt, calendarVersion: 'krx-2026-v1', rawSha256: 'a'.repeat(64),
    dataset, datasetSha256: symbol.padEnd(64, '0'), candlesSha256: symbol.padEnd(64, '1'), revisedDates: [] });
}
const week = ['20260922', '20260923', '20260928'];
const now = () => new Date('2026-09-29T00:05:00Z');

describe('universe dataset', () => {
  it('combines confirmed, aligned symbols and reports exclusions', async () => {
    const repo = createMemorySnapshotRepository();
    await save(repo, '005930', week, '2026-09-28T23:05:00Z');
    await save(repo, '000660', week, '2026-09-28T23:06:00Z');
    await save(repo, '373220', week, '2026-09-28T09:30:00Z');
    await save(repo, '207940', ['20260923', '20260928'], '2026-09-28T23:07:00Z');
    const result = await createUniverseDatasetBuilder({ snapshots: repo, symbols: ['005930', '000660', '373220', '207940', '005380'], label: 'u-v1', now })();
    if (result.status !== 'ready') throw new Error(result.reason);
    expect(result.data.series.map((s) => s.symbol)).toEqual(['005930', '000660']);
    expect(result.data.sessions).toEqual(week);
    expect(result.data.source).toBe('KIS daily snapshots u-v1 through 20260928');
    expect(result.excluded).toEqual([{ symbol: '373220', reason: 'snapshot_unconfirmed' }, { symbol: '207940', reason: 'sessions_mismatch' },
      { symbol: '005380', reason: 'snapshot_missing' }]);
  });

  it('skips when nothing is confirmed or the day is not a session', async () => {
    const repo = createMemorySnapshotRepository();
    expect(await createUniverseDatasetBuilder({ snapshots: repo, symbols: ['005930'], label: 'u', now })()).toEqual({ status: 'skipped', reason: 'no_confirmed_data' });
    expect(await createUniverseDatasetBuilder({ snapshots: repo, symbols: ['005930'], label: 'u', now: () => new Date('2026-10-05T01:00:00Z') })())
      .toEqual({ status: 'skipped', reason: 'not_a_session' });
  });
});
