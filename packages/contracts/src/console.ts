import type { OrderResponse } from './orders.js';
import type { DailyCandle } from './strategy.js';

/** Runtime switches as the server parsed them; never secrets or account identifiers. */
export interface ConsoleStatusResponse {
  checkedAt: string;
  tradingMode: 'paper' | 'live';
  liveTradingEnabled: boolean;
  paperExecutionEnabled: boolean;
  paperLoopEnabled: boolean;
  killSwitchEnabled: boolean;
  marketDataScheduleEnabled: boolean;
  paperLoopScheduleEnabled: boolean;
  calendar: { version: string; from: string; through: string };
}

export type ConsoleLoopStatus = 'CLAIMED' | 'TRACKING' | 'COMPLETE' | 'HALTED';

/** Paper-loop run without its input dataset; quantities are shares, prices KRW strings. */
export interface ConsoleLoopRun {
  id: string;
  runKey: string;
  sessionDate: string;
  status: ConsoleLoopStatus;
  reason: string | null;
  dataSha256: string;
  dataRef: string;
  signal: { reason: string; side: 'BUY' | 'SELL' | null; quantity: string | null } | null;
  decision: { approved: boolean; reasons: string[] } | null;
  order: OrderResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsoleSnapshot {
  id: string;
  symbol: string;
  through: string;
  collectedAt: string;
  calendarVersion: string;
  bars: number;
  datasetSha256: string;
  candlesSha256: string;
  revisedDates: string[];
  /** Latest retrieval that returned exactly these candles. */
  confirmedAt: string;
  lastBar: DailyCandle | null;
}

export interface ConsoleList<T> {
  items: T[];
}
