import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { bar, createMemorySnapshotRepository } from '../../../test/marketDataFixtures.ts';
import type { MarketDataset } from '../../domain/strategy/marketData.ts';
import { createPaperLoopPreparer } from './prepare.ts';

const dataset = (sessions: string[]): MarketDataset => ({ source: 'fixture', timezone: 'Asia/Seoul', priceBasis: 'raw',
  sessions, series: [{ symbol: '005930', candles: sessions.map((date) => bar(date)) }] });
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function repositoryWith(through: string, sessions: string[], collectedAt = '2026-09-28T23:05:00.000Z') {
  const snapshots = createMemorySnapshotRepository();
  const data = dataset(sessions);
  await snapshots.save({ symbol: '005930', through, collectedAt, calendarVersion: 'krx-2026-v2',
    rawSha256: 'a'.repeat(64), dataset: data, datasetSha256: digest(data), candlesSha256: 'b'.repeat(64), revisedDates: [] });
  return { snapshots, data };
}
const at = (iso: string) => () => new Date(iso);

describe('paper loop preparer', () => {
  it('builds a validated tick input from the previous session snapshot', async () => {
    const { snapshots, data } = await repositoryWith('20260928', ['20260922', '20260923', '20260928']);
    const result = await createPaperLoopPreparer({ snapshots, now: at('2026-09-29T00:05:00.000Z') })();
    expect(result).toEqual({ status: 'ready', input: {
      runKey: `loop-20260929-${digest(data).slice(0, 12)}`, sessionDate: '20260929', dataSha256: digest(data),
      dataRef: 'market_daily_snapshots:snapshot-1',
      calendar: { source: 'krx-2026-v2 (repository-reviewed KRX calendar)', sessions: ['20260922', '20260923', '20260928', '20260929'] },
      data } });
  });

  it('uses the last session before a closure', async () => {
    const { snapshots } = await repositoryWith('20261002', ['20260930', '20261001', '20261002'], '2026-10-05T23:30:00.000Z');
    const result = await createPaperLoopPreparer({ snapshots, now: at('2026-10-06T00:05:00.000Z') })();
    expect(result.status).toBe('ready');
  });

  it('skips until the previous bar is re-confirmed on the session morning', async () => {
    const { snapshots, data } = await repositoryWith('20260928', ['20260922', '20260923', '20260928'], '2026-09-28T09:30:00.000Z');
    const at = () => new Date('2026-09-29T00:05:00.000Z');
    expect(await createPaperLoopPreparer({ snapshots, now: at })()).toEqual({ status: 'skipped', reason: 'snapshot_unconfirmed' });
    // 07:59 KST is still before the confirmation window.
    await snapshots.save({ symbol: '005930', through: '20260928', collectedAt: '2026-09-28T22:59:00.000Z', calendarVersion: 'krx-2026-v2',
      rawSha256: 'a'.repeat(64), dataset: data, datasetSha256: digest(data), candlesSha256: 'b'.repeat(64), revisedDates: [] });
    expect((await createPaperLoopPreparer({ snapshots, now: at })()).status).toBe('skipped');
    await snapshots.save({ symbol: '005930', through: '20260928', collectedAt: '2026-09-28T23:00:00.000Z', calendarVersion: 'krx-2026-v2',
      rawSha256: 'a'.repeat(64), dataset: data, datasetSha256: digest(data), candlesSha256: 'b'.repeat(64), revisedDates: [] });
    expect((await createPaperLoopPreparer({ snapshots, now: at })()).status).toBe('ready');
    expect(snapshots.rows).toHaveLength(1);
  });

  it.each([
    ['weekend', '2026-09-27T00:05:00.000Z', 'not_a_session'],
    ['closure', '2026-10-05T00:05:00.000Z', 'not_a_session'],
    ['uncovered date', '2026-12-31T00:05:00.000Z', 'calendar_unknown'],
    ['missing snapshot', '2026-09-30T00:05:00.000Z', 'snapshot_missing'],
  ])('skips on %s', async (_name, now, reason) => {
    const { snapshots } = await repositoryWith('20260928', ['20260922', '20260923', '20260928']);
    expect(await createPaperLoopPreparer({ snapshots, now: at(now) })()).toEqual({ status: 'skipped', reason });
  });
});
