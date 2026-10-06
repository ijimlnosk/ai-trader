import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment.ts';
import { hasLiveTradingOptIn } from '../domain/tradingSafety.ts';

const base = { DATABASE_URL: 'postgresql://test:test@localhost:5432/test' };
describe('environment and trading safety', () => {
  it('defaults to paper with live disabled', () => {
    expect(parseEnvironment(base)).toMatchObject({ BROKER_MODE: 'paper', LIVE_TRADING_ENABLED: false, PAPER_LOOP_ENABLED: false, PAPER_ORDER_EXECUTION_ENABLED: false, PORT: 3000 });
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

it('loop opt-in requires strong authentication but never implicitly enables order execution', () => {
  expect(() => parseEnvironment({ ...base, PAPER_LOOP_ENABLED: 'true' })).toThrow('ORDER_API_TOKEN');
  expect(parseEnvironment({ ...base, PAPER_LOOP_ENABLED: 'true', ORDER_API_TOKEN: 'x'.repeat(32) }))
    .toMatchObject({ PAPER_LOOP_ENABLED: true, PAPER_ORDER_EXECUTION_ENABLED: false, LIVE_TRADING_ENABLED: false });
});

it('daily schedules default off and the automatic tick needs every execution opt-in', () => {
  expect(parseEnvironment(base)).toMatchObject({ MARKET_DATA_SCHEDULE_ENABLED: false, PAPER_LOOP_SCHEDULE_ENABLED: false });
  expect(parseEnvironment({ ...base, MARKET_DATA_SCHEDULE_ENABLED: 'true' }))
    .toMatchObject({ MARKET_DATA_SCHEDULE_ENABLED: true, PAPER_LOOP_ENABLED: false, PAPER_ORDER_EXECUTION_ENABLED: false });
  const armed = { ...base, ORDER_API_TOKEN: 'x'.repeat(32), PAPER_LOOP_SCHEDULE_ENABLED: 'true' };
  expect(() => parseEnvironment(armed)).toThrow('PAPER_LOOP_SCHEDULE_ENABLED');
  expect(() => parseEnvironment({ ...armed, PAPER_LOOP_ENABLED: 'true' })).toThrow('PAPER_LOOP_SCHEDULE_ENABLED');
  expect(() => parseEnvironment({ ...armed, PAPER_ORDER_EXECUTION_ENABLED: 'true' })).toThrow('PAPER_LOOP_SCHEDULE_ENABLED');
  const full = { ...armed, PAPER_LOOP_ENABLED: 'true', PAPER_ORDER_EXECUTION_ENABLED: 'true' };
  expect(() => parseEnvironment({ ...full, PAPER_LOOP_TASK_FILE: '/app/task.json' })).toThrow('PAPER_LOOP_SCHEDULE_ENABLED');
  expect(parseEnvironment(full)).toMatchObject({ PAPER_LOOP_SCHEDULE_ENABLED: true, LIVE_TRADING_ENABLED: false });
});

it('console read token must be strong and distinct from the order token', () => {
  expect(parseEnvironment(base).CONSOLE_READ_TOKEN).toBeUndefined();
  expect(() => parseEnvironment({ ...base, CONSOLE_READ_TOKEN: 'short' })).toThrow('CONSOLE_READ_TOKEN');
  expect(() => parseEnvironment({ ...base, CONSOLE_READ_TOKEN: 'x'.repeat(32), ORDER_API_TOKEN: 'x'.repeat(32) })).toThrow('CONSOLE_READ_TOKEN');
  expect(parseEnvironment({ ...base, CONSOLE_READ_TOKEN: 'r'.repeat(32), ORDER_API_TOKEN: 'x'.repeat(32) }))
    .toMatchObject({ CONSOLE_READ_TOKEN: 'r'.repeat(32) });
});

it('momentum execution needs paper execution and the plan schedule and excludes the EMA loop schedule', () => {
  const on = { ...base, ORDER_API_TOKEN: 'x'.repeat(32), MOMENTUM_EXECUTION_ENABLED: 'true' };
  expect(parseEnvironment(base).MOMENTUM_EXECUTION_ENABLED).toBe(false);
  expect(() => parseEnvironment(on)).toThrow('MOMENTUM_EXECUTION_ENABLED');
  expect(() => parseEnvironment({ ...on, PAPER_ORDER_EXECUTION_ENABLED: 'true' })).toThrow('MOMENTUM_EXECUTION_ENABLED');
  const valid = { ...on, PAPER_ORDER_EXECUTION_ENABLED: 'true', UNIVERSE_PLAN_SCHEDULE_ENABLED: 'true' };
  expect(parseEnvironment(valid)).toMatchObject({ MOMENTUM_EXECUTION_ENABLED: true, LIVE_TRADING_ENABLED: false });
  expect(() => parseEnvironment({ ...valid, PAPER_LOOP_ENABLED: 'true', PAPER_LOOP_SCHEDULE_ENABLED: 'true' })).toThrow('MOMENTUM_EXECUTION_ENABLED');
});

it('AI news analysis needs a key and the plan schedule, and budgets cannot exceed the owner limit', () => {
  expect(parseEnvironment(base)).toMatchObject({ NEWS_ANALYSIS_ENABLED: false, NEWS_ANALYSIS_MODEL: 'claude-opus-5-5', AI_DAILY_BUDGET_USD: 0.5, AI_MONTHLY_BUDGET_USD: 6.5 });
  expect(() => parseEnvironment({ ...base, NEWS_ANALYSIS_ENABLED: 'true' })).toThrow('NEWS_ANALYSIS_ENABLED');
  expect(parseEnvironment({ ...base, NEWS_ANALYSIS_ENABLED: 'true', ANTHROPIC_API_KEY: 'sk-ant-test', UNIVERSE_PLAN_SCHEDULE_ENABLED: 'true' }).NEWS_ANALYSIS_ENABLED).toBe(true);
  expect(parseEnvironment({ ...base, AI_MONTHLY_BUDGET_USD: '7' }).AI_MONTHLY_BUDGET_USD).toBe(7);
  for (const [key, value] of [['AI_MONTHLY_BUDGET_USD', '7.01'], ['AI_DAILY_BUDGET_USD', '1.5'], ['AI_DAILY_BUDGET_USD', '0'], ['NEWS_ANALYSIS_MODEL', 'gpt-5']]) {
    expect(() => parseEnvironment({ ...base, [key!]: value })).toThrow(key!);
  }
});
it('keeps the take-profit dry run off by default and enables it only explicitly', () => {
  expect(parseEnvironment(base).INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED).toBe(false);
  expect(parseEnvironment({ ...base, INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED: 'true' }))
    .toMatchObject({ INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED: true, PAPER_ORDER_EXECUTION_ENABLED: false, LIVE_TRADING_ENABLED: false });
  expect(() => parseEnvironment({ ...base, INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED: 'yes' })).toThrow('INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED');
});
it('requires a DART key for the disclosure schedule and keeps it off by default', () => {
  expect(parseEnvironment(base).DISCLOSURE_SCHEDULE_ENABLED).toBe(false);
  expect(() => parseEnvironment({ ...base, DISCLOSURE_SCHEDULE_ENABLED: 'true' })).toThrow('DISCLOSURE_SCHEDULE_ENABLED');
  expect(parseEnvironment({ ...base, DISCLOSURE_SCHEDULE_ENABLED: 'true', DART_API_KEY: 'k' })).toMatchObject({ DISCLOSURE_SCHEDULE_ENABLED: true });
});
