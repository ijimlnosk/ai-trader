/** Persisted with the order request, including selected-symbol inputs for replay. */
export interface StrategyProvenance {
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
