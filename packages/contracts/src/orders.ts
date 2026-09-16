export interface CreateOrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  orderType: 'MARKET';
  confidence: string;
}
export type ExecutionStatus = 'PREPARING' | 'RISK_REJECTED' | 'FAILED' | 'SUBMITTING' | 'UNKNOWN'
  | 'SUBMITTED' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'BROKER_REJECTED';
export interface OrderResponse {
  id: string;
  proposalId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  requestedPrice: string | null;
  orderType: 'MARKET';
  riskStatus: 'pending' | 'approved' | 'rejected';
  riskReasons: string[];
  brokerOrderId: string | null;
  brokerStatus: ExecutionStatus;
  filledQuantity: string;
  filledAmount: string;
  positionsSyncedAt: string | null;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
}
