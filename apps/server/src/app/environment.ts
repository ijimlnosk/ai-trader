import { z } from 'zod';
import { KIS_PAPER_URL } from '../infrastructure/broker/kis/index.ts';

const optionalSecret = z.string().trim().transform((value) => value || undefined).optional();
const usdBudget = (maximum: number) => z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).pipe(z.number().positive().max(maximum));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65535)).default(3000),
  DATABASE_URL: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  }),
  KIS_APP_KEY: optionalSecret,
  KIS_APP_SECRET: optionalSecret,
  KIS_BASE_URL: z.literal(KIS_PAPER_URL).default(KIS_PAPER_URL),
  KIS_ACCOUNT_NO: optionalSecret,
  KIS_ACCOUNT_PRODUCT_CODE: optionalSecret,
  BROKER_MODE: z.enum(['paper', 'live']).default('paper'),
  LIVE_TRADING_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  PAPER_ORDER_EXECUTION_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  PAPER_LOOP_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  PAPER_LOOP_TASK_FILE: z.string().trim().min(1).optional(),
  MARKET_DATA_SCHEDULE_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  PAPER_LOOP_SCHEDULE_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ORDER_API_TOKEN: optionalSecret,
  CONSOLE_READ_TOKEN: optionalSecret,
  NAVER_CLIENT_ID: optionalSecret,
  NAVER_CLIENT_SECRET: optionalSecret,
  // Self-imposed caps far below the provider's 25,000/day and 775,000/month; hard maxima enforced here.
  NAVER_DAILY_CALL_CAP: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(20000)).default(1000),
  NAVER_MONTHLY_CALL_CAP: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(600000)).default(20000),
  NEWS_SCHEDULE_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  UNIVERSE_PLAN_SCHEDULE_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  MOMENTUM_EXECUTION_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  MINUTE_BARS_SCHEDULE_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  // Records take-profit crossings of held positions during the session; never creates orders.
  INTRADAY_TAKE_PROFIT_DRY_RUN_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DART_API_KEY: optionalSecret,
  // Archives OpenDART filings of universe symbols each session morning; data only.
  DISCLOSURE_SCHEDULE_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ANTHROPIC_API_KEY: optionalSecret,
  // AI news screening of momentum candidates; record-only until enforcement is separately approved.
  NEWS_ANALYSIS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  NEWS_ANALYSIS_MODEL: z.enum(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5']).default('claude-opus-5-5'),
  // USD caps (owner limit: about KRW 10,000/month). Hard maxima: $1/day, $7/month.
  AI_DAILY_BUDGET_USD: usdBudget(1).default(0.5),
  AI_MONTHLY_BUDGET_USD: usdBudget(7).default(6.5),
  TRADING_KILL_SWITCH_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
}).superRefine((value, ctx) => {
  if ((value.PAPER_ORDER_EXECUTION_ENABLED || value.PAPER_LOOP_ENABLED) && (!value.ORDER_API_TOKEN || value.ORDER_API_TOKEN.length < 32)) {
    ctx.addIssue({ code: 'custom', path: ['ORDER_API_TOKEN'], message: 'At least 32 characters required for execution' });
  }
  // A read token must not double as the order token, so leaking it cannot authorize orders.
  if (value.CONSOLE_READ_TOKEN && (value.CONSOLE_READ_TOKEN.length < 32 || value.CONSOLE_READ_TOKEN === value.ORDER_API_TOKEN)) {
    ctx.addIssue({ code: 'custom', path: ['CONSOLE_READ_TOKEN'], message: 'At least 32 characters and distinct from ORDER_API_TOKEN' });
  }
  if (value.DISCLOSURE_SCHEDULE_ENABLED && !value.DART_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['DISCLOSURE_SCHEDULE_ENABLED'], message: 'DART_API_KEY required' });
  }
  if (value.NEWS_SCHEDULE_ENABLED && (!value.NAVER_CLIENT_ID || !value.NAVER_CLIENT_SECRET)) {
    ctx.addIssue({ code: 'custom', path: ['NEWS_SCHEDULE_ENABLED'], message: 'Naver credentials required' });
  }
  // Momentum executes the daily universe plan; one automated strategy per account at a time.
  if (value.MOMENTUM_EXECUTION_ENABLED && (!value.PAPER_ORDER_EXECUTION_ENABLED || !value.UNIVERSE_PLAN_SCHEDULE_ENABLED
    || value.PAPER_LOOP_SCHEDULE_ENABLED || value.PAPER_LOOP_TASK_FILE)) {
    ctx.addIssue({ code: 'custom', path: ['MOMENTUM_EXECUTION_ENABLED'], message: 'Requires execution and plan schedule, excludes the EMA loop schedule' });
  }
  if (value.NEWS_ANALYSIS_ENABLED && (!value.ANTHROPIC_API_KEY || !value.UNIVERSE_PLAN_SCHEDULE_ENABLED)) {
    ctx.addIssue({ code: 'custom', path: ['NEWS_ANALYSIS_ENABLED'], message: 'Requires ANTHROPIC_API_KEY and the plan schedule' });
  }
  // The automatic tick is a third deliberate opt-in on top of both loop and execution opt-ins.
  if (value.PAPER_LOOP_SCHEDULE_ENABLED && (!value.PAPER_LOOP_ENABLED || !value.PAPER_ORDER_EXECUTION_ENABLED || value.PAPER_LOOP_TASK_FILE)) {
    ctx.addIssue({ code: 'custom', path: ['PAPER_LOOP_SCHEDULE_ENABLED'], message: 'Requires loop and execution opt-ins and no task file' });
  }
});

export function parseEnvironment(input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Never include input values or Zod errors that may contain credentials.
    const keys = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment variables: ${keys.join(', ')}`);
  }
  return result.data;
}

export type Environment = ReturnType<typeof parseEnvironment>;
