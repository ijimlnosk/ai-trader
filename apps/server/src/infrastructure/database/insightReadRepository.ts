import { desc, sql } from 'drizzle-orm';
import type { InsightReadRepository } from '../../application/console/insights.ts';
import type { createDatabase } from './index.ts';
import { dartDisclosures, intradaySignals, marketMinuteBars } from './schema.ts';

type Database = ReturnType<typeof createDatabase>['db'];
type CoverageRow = { date: string; symbols: number; min_bars: number; max_bars: number };

/** Read-only aggregates for the insights view; each read is bounded. */
export function createInsightReadRepository(db: Database): InsightReadRepository {
  return {
    async dailyCoverage(sessions) {
      // Latest retrieval per symbol and session; earlier, shorter retrievals of the same session do not count.
      const result = await db.execute<CoverageRow>(sql`SELECT through AS date, count(*)::int AS symbols, min(n)::int AS min_bars, max(n)::int AS max_bars
        FROM (SELECT DISTINCT ON (symbol, through) through, jsonb_array_length(dataset->'sessions') AS n FROM market_daily_snapshots
          ORDER BY symbol, through, collected_at DESC) latest GROUP BY through ORDER BY through DESC LIMIT ${sessions}`);
      return result.rows.map((row) => ({ through: row.date, symbols: row.symbols, minBars: row.min_bars, maxBars: row.max_bars }));
    },
    async minuteCoverage(sessions) {
      return db.select({ sessionDate: marketMinuteBars.sessionDate, symbols: sql<number>`count(*)::int`,
        minBars: sql<number>`min(${marketMinuteBars.barCount})::int`, maxBars: sql<number>`max(${marketMinuteBars.barCount})::int` })
        .from(marketMinuteBars).groupBy(marketMinuteBars.sessionDate).orderBy(desc(marketMinuteBars.sessionDate)).limit(sessions);
    },
    async recentDisclosures(limit) {
      return db.select({ receiptNo: dartDisclosures.receiptNo, symbol: dartDisclosures.stockCode, receiptDate: dartDisclosures.receiptDate,
        reportName: dartDisclosures.reportName }).from(dartDisclosures).orderBy(desc(dartDisclosures.receiptNo)).limit(limit);
    },
    async recentTakeProfit(limit) {
      const rows = await db.select().from(intradaySignals).orderBy(desc(intradaySignals.detectedAt)).limit(limit);
      return rows.map((row) => ({ symbol: row.symbol, sessionDate: row.sessionDate, rule: row.rule, averagePrice: row.averagePrice, price: row.price,
        gainBps: row.gainBps, detectedAt: row.detectedAt.toISOString() }));
    },
  };
}
