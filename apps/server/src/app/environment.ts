import { z } from 'zod';
import { KIS_PAPER_URL } from '../infrastructure/broker/kis/index.ts';

const optionalSecret = z.string().trim().transform((value) => value || undefined).optional();

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
  ORDER_API_TOKEN: optionalSecret,
  TRADING_KILL_SWITCH_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
}).superRefine((value, ctx) => {
  if (value.PAPER_ORDER_EXECUTION_ENABLED && (!value.ORDER_API_TOKEN || value.ORDER_API_TOKEN.length < 32)) {
    ctx.addIssue({ code: 'custom', path: ['ORDER_API_TOKEN'], message: 'At least 32 characters required for execution' });
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
