import { DAY_V1, type DayConfig } from './dayTrading.ts';
import { ETF_V1, type EtfConfig } from './etfRotation.ts';

/**
 * Owner-selectable rule presets. Ledger ids stay `day-v1` / `etf-v1` whatever the preset, so results continue.
 * Day presets are judged by their virtual record (no backtest of intraday exits exists); ETF presets carry the
 * 2026-10-07 backtest (docs/ETF_MOMENTUM_RESEARCH_2026-10-07.md, KRW 500,000, return / max drawdown in %).
 */
export const DAY_PRESETS = {
  'day-v1': { label: '기본 (+5% / −3%)', config: DAY_V1 },
  'day-quick': { label: '빠른 회전 (+3% / −2%)', config: { ...DAY_V1, targetBps: 300n, trailArmBps: 200n, trailDropBps: 100n, stopBps: 200n, rebuyDropBps: 150n } },
  'day-patient': { label: '여유 (+8% / −4%)', config: { ...DAY_V1, targetBps: 800n, trailArmBps: 400n, trailDropBps: 200n, stopBps: 400n, rebuyDropBps: 300n } },
} as const satisfies Record<string, { label: string; config: DayConfig }>;
export type DayPresetId = keyof typeof DAY_PRESETS;

export const ETF_PRESETS = {
  'etf-v1': { label: '20일 · 3개 · 120일 추세 필터', config: ETF_V1, backtest: { inReturn: 35.7, inDrawdown: 15.2, outReturn: 37.1, outDrawdown: 29.5 } },
  'etf-20-3': { label: '20일 · 3개 · 필터 없음', config: { ...ETF_V1, trendMa: 0 }, backtest: { inReturn: 44.2, inDrawdown: 17.0, outReturn: 28.6, outDrawdown: 33.0 } },
  'etf-20-2': { label: '20일 · 2개 · 필터 없음', config: { ...ETF_V1, trendMa: 0, positions: 2, keepRanks: 4 }, backtest: { inReturn: 50.1, inDrawdown: 21.5, outReturn: 58.9, outDrawdown: 37.4 } },
} as const satisfies Record<string, { label: string; config: EtfConfig; backtest: Record<string, number> }>;
export type EtfPresetId = keyof typeof ETF_PRESETS;
