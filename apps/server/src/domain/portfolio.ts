/** KRW amounts/prices, shares quantities and percentage rates; all exact strings. */
export interface Position {
  symbol: string;
  name: string;
  quantity: string;
  availableQuantity: string;
  averagePrice: string;
  currentPrice: string;
  evaluationAmount: string;
  profitLoss: string;
  profitLossRate: string;
}

export interface Portfolio {
  /** Deposit balance, not buying power or withdrawable cash. */
  cash: string;
  totalEvaluation: string;
  totalPurchaseAmount: string;
  totalProfitLoss: string;
  totalProfitLossRate: string;
  positions: Position[];
}
