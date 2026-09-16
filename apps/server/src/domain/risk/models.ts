export type TradeSide = 'BUY' | 'SELL';

/** Domestic stock: six-digit symbol, KRW price, shares, confidence as a 0–1 ratio. */
export interface TradeProposal {
  symbol: string;
  side: TradeSide;
  quantity: string;
  estimatedPrice: string;
  confidence: string;
  createdAt: string;
}

export interface RiskContext {
  /** Available buying power in KRW, NOT Portfolio.cash (deposit balance). */
  cash: string;
  totalEquity: string;
  /** Realized KRW P/L for the current Asia/Seoul trading day. */
  dailyRealizedPnl: string;
  openPositionCount: number;
  consecutiveLosses: number;
  killSwitchEnabled: boolean;
}

export { RiskRejection, type RiskRejectionReason, type RiskDecision } from '@ai-trader/contracts';
