import { validateCandles, validateDataset } from '../../domain/strategy/marketData.ts';
import { z } from 'zod';
const amount = z.string().max(26);
export const candleSchema = z.strictObject({ date: z.string().regex(/^\d{8}$/), open: amount, high: amount, low: amount, close: amount,
  volume: z.string().max(16) });
export const candleHistorySchema = z.array(candleSchema).min(1).max(10000).superRefine((candles, context) => {
  try { validateCandles(candles); }
  catch { context.addIssue({ code: 'custom', message: 'Invalid daily candles' }); }
});
export const datasetSchema = z.strictObject({ source: z.string().trim().min(1).max(200), timezone: z.literal('Asia/Seoul'),
  priceBasis: z.literal('raw'), sessions: z.array(z.string().regex(/^\d{8}$/)).min(1).max(10000),
  series: z.array(z.strictObject({ symbol: z.string().regex(/^\d{6}$/), candles: candleHistorySchema })).min(1).max(100) }).superRefine((data, context) => {
    try { validateDataset(data); }
    catch { context.addIssue({ code: 'custom', message: 'Invalid daily dataset' }); }
  });

export const strategyInputSchema = z.strictObject({ data: datasetSchema, executeSymbol: z.string().regex(/^[0-9]{6}$/).optional() });
