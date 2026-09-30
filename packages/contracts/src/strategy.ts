/** Persisted with the order request. EMA includes selected-symbol candles; momentum references its plan run. */
export type StrategyProvenance = EmaCrossProvenance | MomentumProvenance;

export interface MomentumProvenance {
  strategyId: 'momentum-rotation';
  version: '1';
  configId: string;
  source: string;
  /** Digest of the universe dataset the plan evaluated. */
  dataSha256: string;
  planRunKey: string;
  evaluatedAt: string;
  reason: string;
  account: { cash: string; totalEquity: string; heldQuantity: string };
  metrics: { momentum: number; trendMa: number; close: string; rank: number | null };
}

export interface EmaCrossProvenance {
  strategyId: 'ema-cross';
  version: '1';
  configId: string;
  source: string;
  dataSha256: string;
  evaluatedAt: string;
  reason: string;
  candles: DailyCandle[];
  account: { cash: string; totalEquity: string; heldQuantity: string };
  indicators: {
    ema20: number; ema60: number; previousEma20: number; previousEma60: number;
    rsi14: number; atr14: number; volumeRatio: number | null;
    trend: 'up' | 'down' | 'mixed';
  };
}

/** KRX regular-session daily OHLCV. Prices KRW; volume whole shares. */
export interface DailyCandle {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}
export interface MarketDataset {
  source: string;
  timezone: 'Asia/Seoul';
  priceBasis: 'raw';
  /** Explicit expected trading sessions, including holidays/exclusions chosen by the data owner. */
  sessions: string[];
  series: { symbol: string; candles: DailyCandle[] }[];
}

export interface StrategyEvaluateRequest {
  data: MarketDataset;
  /** Omit for read-only evaluation. Submit at most this one symbol through existing paper execution. */
  executeSymbol?: string;
}
