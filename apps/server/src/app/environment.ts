import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65535)).default(3000),
  DATABASE_URL: z.string().url().refine((value) => {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname) && url.pathname.length > 1;
  }),
  BROKER_MODE: z.enum(['paper', 'live']).default('paper'),
  LIVE_TRADING_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
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
