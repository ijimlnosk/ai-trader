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
  /** Daily momentum plan execution (paper), exclusive with the EMA loop schedule. */
  momentumExecutionEnabled: boolean;
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

/** Owner-visible automatic trading control; effective = environment allows AND owner enabled. */
export interface ConsoleControlsResponse {
  autoTrading: { enabled: boolean; environmentAllows: boolean; effective: boolean; updatedAt: string | null; updatedByEmail: string | null };
  events: { enabled: boolean; at: string; byEmail: string | null }[];
}

export interface ConsoleNewsResponse {
  items: { id: string; symbol: string; name: string; title: string; description: string; link: string; publishedAt: string }[];
  /** Calls used today/this month against the self-imposed caps (Seoul calendar). */
  usage: { provider: string; daily: number; monthly: number; dailyCap: number; monthlyCap: number } | null;
}

/** One strategy's latest order-free universe plan. Quantities are shares; prices KRW. */
export interface ConsolePlan {
  strategyId: string; label: string; runKey: string; sessionDate: string; createdAt: string; scanned: number; universeSize: number;
  reasons: Record<string, number>;
  items: { rank: number; symbol: string; name: string; side: 'BUY' | 'SELL'; quantity: string; estimatedPrice: string;
    reason: string; approved: boolean; rejections: string[] }[];
}
/** Latest plan per strategy, primary strategy first. */
export interface ConsolePlanResponse { plans: ConsolePlan[] }
