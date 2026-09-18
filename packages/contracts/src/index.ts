export type HealthResponse = {
  tradingMode: 'paper' | 'live';
} & (
  | { status: 'ok'; database: 'connected' }
  | { status: 'error'; database: 'disconnected' }
);

/** Domestic quote: KRW price/change, percentage changeRate, cumulative shares volume. */
export interface QuoteResponse {
  symbol: string;
  price: string;
  change: string;
  changeRate: string;
  volume: string;
  /** UTC server receipt time, not exchange trade time. */
  timestamp: string;
}

export interface BrokerStatusResponse {
  provider: 'kis';
  mode: 'paper';
  configured: boolean;
  reachable: boolean;
  error?: 'configuration_error' | 'authentication_error' | 'provider_unavailable'
    | 'provider_invalid_response' | 'invalid_symbol' | 'account_unavailable';
}

/** KRW amounts/prices, shares quantities and percentage rates; all exact strings. */
export interface PositionResponse {
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

export interface PortfolioResponse {
  /** Deposit balance, not buying power or withdrawable cash. */
  cash: string;
  totalEvaluation: string;
  totalPurchaseAmount: string;
  totalProfitLoss: string;
  totalProfitLossRate: string;
  positions: PositionResponse[];
}

export { RiskRejection, type RiskRejectionReason, type RiskDecision, type RiskEvaluateRequest } from './risk.js';
export type { CreateOrderRequest, ExecutionStatus, OrderResponse } from './orders.js';
export type { StrategyProvenance, DailyCandle, MarketDataset, StrategyEvaluateRequest } from './strategy.js';
