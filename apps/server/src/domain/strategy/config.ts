import { ledgerAmount } from '../tradeLedger.ts';
export interface StrategyConfig {
  minPrice: string;
  minAverageTurnover: string;
  minRsi: number;
  maxRsi: number;
  minVolumeRatio: number;
  riskBudgetBps: number;
  maxAllocationBps: number;
  atrMultiple: number;
}
export const DEFAULT_STRATEGY_CONFIG: Readonly<StrategyConfig> = Object.freeze({
  minPrice: '1000', minAverageTurnover: '100000000', minRsi: 50, maxRsi: 70,
  minVolumeRatio: 1.2, riskBudgetBps: 100, maxAllocationBps: 900, atrMultiple: 2,
});
export function validateStrategyConfig(config: Readonly<StrategyConfig>): void {
  ledgerAmount(config.minPrice); ledgerAmount(config.minAverageTurnover);
  if (![config.minRsi, config.maxRsi, config.minVolumeRatio, config.atrMultiple].every(Number.isFinite)
    || config.minRsi < 0 || config.maxRsi > 100 || config.minRsi > config.maxRsi
    || config.minVolumeRatio < 0 || config.atrMultiple <= 0
    || ![config.riskBudgetBps, config.maxAllocationBps].every((v) => Number.isSafeInteger(v) && v > 0 && v <= 10000)) {
    throw new Error('Invalid strategy configuration');
  }
}
/** Canonical, inspectable configuration identity; no object-key ordering dependency. */
export function strategyConfigId(config: Readonly<StrategyConfig>): string {
  validateStrategyConfig(config);
  return JSON.stringify([config.minPrice, config.minAverageTurnover, config.minRsi, config.maxRsi,
    config.minVolumeRatio, config.riskBudgetBps, config.maxAllocationBps, config.atrMultiple]);
}
