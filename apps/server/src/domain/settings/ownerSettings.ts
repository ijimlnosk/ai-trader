import { DEFAULT_RISK_POLICY } from '../risk/policy.ts';
import { DAY_PRESETS, ETF_PRESETS, type DayPresetId, type EtfPresetId } from '../strategy/presets.ts';

/** Owner-chosen settings. Rates are decimal strings ('0.10' = 10%); risk limits may only be stricter than the defaults. */
export interface OwnerSettings {
  strategies: { momentumExecution: boolean; shadowDayTrading: boolean; shadowEtfRotation: boolean; takeProfitWatch: boolean };
  dayPreset: DayPresetId;
  etfPreset: EtfPresetId;
  risk: { maxPositionExposureRate: string; maxOpenPositions: number; maxDailyLossRate: string; maxConsecutiveLosses: number; minConfidence: string };
}

export const DEFAULT_OWNER_SETTINGS: Readonly<OwnerSettings> = Object.freeze({
  strategies: { momentumExecution: true, shadowDayTrading: true, shadowEtfRotation: true, takeProfitWatch: true },
  dayPreset: 'day-v1', etfPreset: 'etf-v1',
  risk: { maxPositionExposureRate: DEFAULT_RISK_POLICY.maxPositionExposureRate, maxOpenPositions: DEFAULT_RISK_POLICY.maxOpenPositions,
    maxDailyLossRate: DEFAULT_RISK_POLICY.maxDailyLossRate, maxConsecutiveLosses: DEFAULT_RISK_POLICY.maxConsecutiveLosses,
    minConfidence: DEFAULT_RISK_POLICY.minConfidence },
});

const rate = (value: unknown) => typeof value === 'string' && /^0\.\d{1,4}$|^1(\.0{1,4})?$/.test(value) ? Number(value) : NaN;
const int = (value: unknown) => typeof value === 'number' && Number.isInteger(value) ? value : NaN;
const bool = (value: unknown) => typeof value === 'boolean';

/**
 * Validates untrusted input. Risk limits must be within [floor, default]: tighter than or equal to the default policy,
 * never looser (loosening needs a decision record and a separate change), and not so tight that they are meaningless.
 */
export function parseOwnerSettings(input: unknown): { settings: OwnerSettings } | { errors: string[] } {
  const errors: string[] = [];
  const value = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const strategies = (value.strategies ?? {}) as Record<string, unknown>;
  const risk = (value.risk ?? {}) as Record<string, unknown>;
  for (const key of ['momentumExecution', 'shadowDayTrading', 'shadowEtfRotation', 'takeProfitWatch']) if (!bool(strategies[key])) errors.push(`strategies.${key}`);
  if (typeof value.dayPreset !== 'string' || !Object.hasOwn(DAY_PRESETS, value.dayPreset)) errors.push('dayPreset');
  if (typeof value.etfPreset !== 'string' || !Object.hasOwn(ETF_PRESETS, value.etfPreset)) errors.push('etfPreset');
  const within = (name: string, actual: number, min: number, max: number) => { if (!(actual >= min && actual <= max)) errors.push(`risk.${name}`); };
  const d = DEFAULT_RISK_POLICY;
  within('maxPositionExposureRate', rate(risk.maxPositionExposureRate), 0.01, Number(d.maxPositionExposureRate));
  within('maxOpenPositions', int(risk.maxOpenPositions), 1, d.maxOpenPositions);
  within('maxDailyLossRate', rate(risk.maxDailyLossRate), 0.005, Number(d.maxDailyLossRate));
  within('maxConsecutiveLosses', int(risk.maxConsecutiveLosses), 1, d.maxConsecutiveLosses);
  within('minConfidence', rate(risk.minConfidence), Number(d.minConfidence), 1);
  if (errors.length > 0) return { errors };
  return { settings: {
    strategies: { momentumExecution: strategies.momentumExecution as boolean, shadowDayTrading: strategies.shadowDayTrading as boolean,
      shadowEtfRotation: strategies.shadowEtfRotation as boolean, takeProfitWatch: strategies.takeProfitWatch as boolean },
    dayPreset: value.dayPreset as DayPresetId, etfPreset: value.etfPreset as EtfPresetId,
    risk: { maxPositionExposureRate: risk.maxPositionExposureRate as string, maxOpenPositions: risk.maxOpenPositions as number,
      maxDailyLossRate: risk.maxDailyLossRate as string, maxConsecutiveLosses: risk.maxConsecutiveLosses as number, minConfidence: risk.minConfidence as string },
  } };
}
