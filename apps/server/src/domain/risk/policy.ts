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

/**
 * Owner decision 2026-09-30 (decision 0012): a consecutive-loss streak expires once this many
 * trading sessions have passed after its latest losing sale. Unknown session counts never expire it.
 */
export const CONSECUTIVE_LOSS_COOLDOWN_SESSIONS = 5;
