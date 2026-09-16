import { z } from 'zod';
import { parseRiskDecimal } from '../../domain/risk/index.ts';

export const orderInputSchema = z.strictObject({
  symbol: z.string().length(6).regex(/^[0-9]{6}$/),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.string().max(9).regex(/^[1-9][0-9]*$/),
  orderType: z.literal('MARKET'),
  confidence: z.string().max(6).regex(/^(?:0(?:\.[0-9]{1,4})?|1(?:\.0{1,4})?)$/),
});
export function sameOrderInput(left: unknown, right: unknown): boolean {
  const a = orderInputSchema.safeParse(left); const b = orderInputSchema.safeParse(right);
  return a.success && b.success && JSON.stringify(a.data) === JSON.stringify(b.data);
}
export function validAmount(value: string, positive = false): boolean {
  const parsed = parseRiskDecimal(value);
  return parsed !== null && (positive ? parsed > 0n : parsed >= 0n);
}
