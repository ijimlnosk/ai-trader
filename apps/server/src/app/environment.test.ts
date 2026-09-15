import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment.ts';
import { hasLiveTradingOptIn } from '../domain/tradingSafety.ts';

const base = { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' };
describe('environment and trading safety', () => {
  it('defaults to paper with live disabled', () => {
    expect(parseEnvironment(base)).toMatchObject({ BROKER_MODE: 'paper', LIVE_TRADING_ENABLED: false, PORT: 3000 });
  });
  it.each([
    ['BROKER_MODE', 'LIVE'], ['BROKER_MODE', ''], ['LIVE_TRADING_ENABLED', '1'],
    ['LIVE_TRADING_ENABLED', ''], ['PORT', '0'], ['PORT', '65536'], ['PORT', '3.5'],
    ['HOST', ''], ['NODE_ENV', 'invalid'], ['DATABASE_URL', 'https://localhost/db'],
    ['DATABASE_URL', 'postgresql://localhost'],
  ])('rejects invalid %s=%s', (key, value) => {
    expect(() => parseEnvironment({ ...base, [key]: value })).toThrow('Invalid environment variables');
  });
  it('requires database URL without exposing input', () => {
    expect(() => parseEnvironment({})).toThrow('DATABASE_URL');
    expect(() => parseEnvironment({ DATABASE_URL: 'sensitive-value' })).not.toThrow('sensitive-value');
  });
  it.each([
    ['paper', false, false], ['paper', true, false], ['live', false, false], ['live', true, true],
  ] as const)('configuration gate %s / %s = %s', (brokerMode, liveTradingEnabled, expected) => {
    const config = parseEnvironment({ ...base, BROKER_MODE: brokerMode, LIVE_TRADING_ENABLED: String(liveTradingEnabled) });
    expect(hasLiveTradingOptIn({ brokerMode: config.BROKER_MODE, liveTradingEnabled: config.LIVE_TRADING_ENABLED })).toBe(expected);
  });
});
