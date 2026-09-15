// Domestic stocks: KRW prices/change, percent changeRate, cumulative shares volume.
export interface Quote {
  symbol: string;
  price: string;
  change: string;
  changeRate: string;
  volume: string;
  /** UTC receipt time, not an exchange trade timestamp. */
  timestamp: string;
}
