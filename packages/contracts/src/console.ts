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
    reason: string; approved: boolean; rejections: string[];
    /** AI news screening for this session (record-only), when available. */
    news: { status: 'assessed' | 'unavailable' | 'no_news' | 'budget_exhausted'; verdict: 'clear' | 'caution' | 'veto' | null;
      summary: string | null; categories: string[] } | null }[];
}
/** Latest plan per strategy, primary strategy first; AI spend in micro-USD against the caps. */
export interface ConsolePlanResponse {
  plans: ConsolePlan[];
  aiUsage: { model: string; dailyMicroUsd: number; monthlyMicroUsd: number; dailyCapMicroUsd: number; monthlyCapMicroUsd: number } | null;
}

/** Why momentum chose what it chose and what has been collected. Read-only; prices KRW, quantities shares. */
export interface ConsoleInsightsResponse {
  momentum: {
    runKey: string; sessionDate: string;
    /** Owner's planned live capital and the per-position budget it allows under the current allocation. */
    smallAccount: { capitalKrw: string; budgetKrw: string };
    rows: { rank: number | null; symbol: string; name: string; reason: string;
      /** 120-session return in percent, rounded to 0.1. */
      momentumPct: number | null; close: string | null; trendMa: string | null; heldQuantity: string;
      proposedQuantity: string | null; affordableSmall: boolean }[];
  } | null;
  collection: {
    daily: { through: string; symbols: number; minBars: number; maxBars: number }[];
    minute: { sessionDate: string; symbols: number; minBars: number; maxBars: number }[];
  };
  disclosures: { receiptNo: string; symbol: string; name: string; receiptDate: string; reportName: string }[];
  /** Dry-run threshold crossings; rule is TAKE_PROFIT_5, TAKE_PROFIT_10 or TAKE_PROFIT_30. */
  takeProfit: { symbol: string; name: string; sessionDate: string; rule: string; averagePrice: string; price: string; gainBps: number; detectedAt: string }[];
  /** Virtual (order-free) ledgers; KRW amounts include fees, holdings at cost. The seed (capital) is never withdrawn. */
  shadows: {
    strategy: string; label: string; capitalKrw: string; cashKrw: string; realizedKrw: string;
    holdings: { symbol: string; name: string; quantity: string; costKrw: string; entryPrice: string }[];
    days: { sessionDate: string; trades: number; realizedKrw: string }[];
    recent: { sessionDate: string; symbol: string; name: string; side: 'BUY' | 'SELL'; quantity: string; fillPrice: string; reason: string; createdAt: string }[];
  }[];
}
