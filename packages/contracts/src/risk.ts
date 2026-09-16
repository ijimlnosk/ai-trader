export const RiskRejection = {
  KILL_SWITCH_ENABLED: 'KILL_SWITCH_ENABLED',
  INVALID_PROPOSAL: 'INVALID_PROPOSAL',
  INVALID_CONTEXT: 'INVALID_CONTEXT',
  INVALID_POLICY: 'INVALID_POLICY',
  INSUFFICIENT_CASH: 'INSUFFICIENT_CASH',
  MAX_POSITION_EXPOSURE_EXCEEDED: 'MAX_POSITION_EXPOSURE_EXCEEDED',
  MAX_PORTFOLIO_POSITIONS_EXCEEDED: 'MAX_PORTFOLIO_POSITIONS_EXCEEDED',
  DAILY_LOSS_LIMIT_EXCEEDED: 'DAILY_LOSS_LIMIT_EXCEEDED',
  CONSECUTIVE_LOSS_LIMIT_EXCEEDED: 'CONSECUTIVE_LOSS_LIMIT_EXCEEDED',
  CONFIDENCE_TOO_LOW: 'CONFIDENCE_TOO_LOW',
} as const;
export type RiskRejectionReason = typeof RiskRejection[keyof typeof RiskRejection];
export type RiskDecision =
  | { approved: true; approvedQuantity: string; reasons: [] }
  | { approved: false; approvedQuantity: '0'; reasons: RiskRejectionReason[] };

export interface RiskEvaluateRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  estimatedPrice: string;
  confidence: string;
}
