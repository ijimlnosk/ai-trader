import { candleHistorySchema } from '../strategy/input.ts';
import { z } from 'zod';
import { parseRiskDecimal } from '../../domain/risk/index.ts';

const strategyAmount = z.string().refine((value) => { const parsed = parseRiskDecimal(value); return parsed !== null && parsed >= 0n; });
const strategySchema = z.strictObject({
  strategyId: z.literal('ema-cross'), version: z.literal('1'), configId: z.string().min(1).max(500),
  source: z.string().min(1).max(200), dataSha256: z.string().regex(/^[a-f0-9]{64}$/),
  evaluatedAt: z.iso.datetime({ precision: 3 }), reason: z.string().min(1).max(100),
  candles: candleHistorySchema, account: z.strictObject({ cash: strategyAmount, totalEquity: strategyAmount, heldQuantity: strategyAmount }),
  indicators: z.strictObject({ ema20: z.number().positive(), ema60: z.number().positive(),
    previousEma20: z.number().positive(), previousEma60: z.number().positive(), rsi14: z.number().min(0).max(100),
    atr14: z.number().nonnegative(), volumeRatio: z.number().nonnegative().nullable(), trend: z.enum(['up', 'down', 'mixed']) }),
});
export const orderInputSchema = z.strictObject({
  symbol: z.string().length(6).regex(/^[0-9]{6}$/),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.string().max(9).regex(/^[1-9][0-9]*$/),
  orderType: z.literal('MARKET'),
  strategy: strategySchema.optional(),
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
