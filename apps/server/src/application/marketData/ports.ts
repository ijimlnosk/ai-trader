import type { DailyCandle, MarketDataset } from '../../domain/strategy/marketData.ts';

/** Provider-neutral completed daily history. Candles are ascending, unique and within the range. */
export interface DailyHistory {
  candles: DailyCandle[];
  /** Human-readable provenance, e.g. provider, transaction and retrieval time. */
  source: string;
  retrievedAt: string;
  /** SHA-256 of the provider's raw response body, retained for audit; the body itself is not. */
  rawSha256: string;
}

export interface DailyHistorySource {
  /** Raw (unadjusted) KRW daily bars for [from, through] as YYYYMMDD Seoul dates. */
  getDailyHistory(symbol: string, from: string, through: string): Promise<DailyHistory>;
}

/** Archived, calendar-validated dataset whose last bar is the completed session `through`. */
export interface DailySnapshot {
  id: string;
  symbol: string;
  through: string;
  collectedAt: string;
  calendarVersion: string;
  rawSha256: string;
  dataset: MarketDataset;
  /** SHA-256 of JSON.stringify(dataset); includes the retrieval-time source string. */
  datasetSha256: string;
  /** SHA-256 of JSON.stringify(sessions and candles) only; identifies identical provider data. */
  candlesSha256: string;
  /** Dates whose bar differs from the previous snapshot of this symbol, recorded not hidden. */
  revisedDates: string[];
  /** Latest retrieval time that returned exactly these candles (at least collectedAt). */
  confirmedAt: string;
}

export interface DailySnapshotRepository {
  latest(symbol: string): Promise<DailySnapshot | null>;
  latestThrough(symbol: string, through: string): Promise<DailySnapshot | null>;
  /** Returns the existing row when the same symbol/through/candles digest is already archived. */
  save(snapshot: Omit<DailySnapshot, 'id' | 'confirmedAt'>): Promise<{ snapshot: DailySnapshot; created: boolean }>;
  /** latestThrough orders by confirmedAt, so a re-confirmed earlier row wins over an unconfirmed revision. */
}
