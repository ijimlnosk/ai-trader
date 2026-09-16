import type { CreateOrderRequest, OrderResponse } from '@ai-trader/contracts';
import type { RiskContext, RiskDecision, RiskPolicy, TradeProposal } from './risk/index.ts';

export type { CreateOrderRequest, OrderResponse } from '@ai-trader/contracts';
export interface OrderAudit {
  proposal: TradeProposal;
  context: RiskContext;
  policy: Readonly<RiskPolicy>;
  decision: RiskDecision;
  evaluatedAt: string;
  quoteReceivedAt: string;
  positionQuantityBefore: string;
}
export interface StoredOrder extends OrderResponse {
  request: CreateOrderRequest;
  idempotencyKey: string;
  version: number;
  audit: OrderAudit | null;
  brokerOrderDate: string | null;
}
export interface OrderRequest {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  orderType: 'MARKET';
}
export interface BrokerFill {
  brokerOrderId: string;
  orderDate: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  filledQuantity: string;
  filledAmount: string;
  status: 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'BROKER_REJECTED';
}

export function seoulOrderDate(time: string): string {
  return new Date(Date.parse(time) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll('-', '');
}
/** Regular-session window only; KIS remains authoritative for holidays/suspensions. */
export function isPaperOrderSession(time: Date): boolean {
  const seoul = new Date(time.getTime() + 9 * 60 * 60 * 1000);
  const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
  return seoul.getUTCDay() > 0 && seoul.getUTCDay() < 6 && minute >= 540 && minute < 920;
}
