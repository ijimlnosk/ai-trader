import { describe, expect, it } from 'vitest';
import { DEFAULT_OWNER_SETTINGS, parseOwnerSettings } from './ownerSettings.ts';

const valid = () => structuredClone(DEFAULT_OWNER_SETTINGS) as unknown as Record<string, Record<string, unknown>>;

describe('owner settings', () => {
  it('accepts the defaults and stricter risk limits', () => {
    expect(parseOwnerSettings(valid())).toEqual({ settings: DEFAULT_OWNER_SETTINGS });
    const strict = valid(); Object.assign(strict.risk!, { maxPositionExposureRate: '0.05', maxOpenPositions: 2, maxDailyLossRate: '0.01', maxConsecutiveLosses: 1, minConfidence: '0.9' });
    expect('settings' in parseOwnerSettings(strict)).toBe(true);
  });

  it.each([
    ['looser exposure', { maxPositionExposureRate: '0.11' }], ['more positions', { maxOpenPositions: 6 }], ['looser daily loss', { maxDailyLossRate: '0.03' }],
    ['more consecutive losses', { maxConsecutiveLosses: 4 }], ['lower confidence', { minConfidence: '0.69' }], ['zero exposure', { maxPositionExposureRate: '0' }],
    ['numeric rate', { maxDailyLossRate: 0.01 }], ['fractional positions', { maxOpenPositions: 2.5 }],
  ])('rejects %s', (_name, change) => {
    const input = valid(); Object.assign(input.risk!, change);
    expect(parseOwnerSettings(input)).toEqual({ errors: [expect.stringMatching(/^risk\./)] });
  });

  it('rejects unknown presets, missing switches and non-objects', () => {
    expect(parseOwnerSettings({ ...valid(), dayPreset: 'day-yolo' })).toEqual({ errors: ['dayPreset'] });
    const input = valid(); delete input.strategies!.takeProfitWatch;
    expect(parseOwnerSettings(input)).toEqual({ errors: ['strategies.takeProfitWatch'] });
    expect('errors' in parseOwnerSettings(null)).toBe(true);
  });
});
