import { z } from 'zod';
import { BrokerError } from '../../../application/brokerError.ts';

export const tokenSchema = z.object({
  access_token: z.string().min(1).refine((value) => !/\s/.test(value)),
  token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
  expires_in: z.number().int().min(61).max(2147483),
});
export const envelopeSchema = z.object({ rt_cd: z.string().min(1), msg_cd: z.string().optional() });
const numericString = z.string().refine((value) => value.trim() === value);
export const decimalString = numericString.max(64).regex(/^[+-]?\d+(\.\d+)?$/);
export const quoteSchema = z.object({
  output: z.object({
    stck_prpr: numericString.regex(/^\d+$/),
    prdy_vrss: decimalString,
    prdy_ctrt: decimalString,
    acml_vol: numericString.regex(/^\d+$/),
  }),
});

export function parseKis<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BrokerError('provider_invalid_response');
  return result.data;
}
