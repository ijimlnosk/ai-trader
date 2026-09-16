export interface RiskPolicy {
  version: string;
  minConfidence: string;
  maxPositionExposureRate: string;
  maxOpenPositions: number;
  maxDailyLossRate: string;
  maxConsecutiveLosses: number;
}

export const DEFAULT_RISK_POLICY: Readonly<RiskPolicy> = Object.freeze({
  version: 'v1',
  minConfidence: '0.70',
  maxPositionExposureRate: '0.10',
  maxOpenPositions: 5,
  maxDailyLossRate: '0.02',
  maxConsecutiveLosses: 3,
});
