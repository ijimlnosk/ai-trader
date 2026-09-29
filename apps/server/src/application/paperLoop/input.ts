import { STRATEGY_IDENTITY } from '../../domain/strategy/evaluate.ts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { datasetSchema } from '../strategy/input.ts';
import { candleTime, validateCandles } from '../../domain/strategy/marketData.ts';
import { isPaperOrderSession, seoulOrderDate } from '../../domain/orders.ts';
import { strategyOrderKey } from '../strategy/index.ts';
import { nextKrxSession } from '../../domain/scheduler/krxCalendar.ts';

export const paperLoopInputSchema = z.strictObject({
  runKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/),
  sessionDate: z.string().regex(/^\d{8}$/),
  dataSha256: z.string().regex(/^[a-f0-9]{64}$/),
  dataRef: z.string().trim().min(1).max(300),
  calendar: z.strictObject({ source: z.string().trim().min(1).max(300),
    sessions: z.array(z.string().regex(/^\d{8}$/)).min(2).max(10001) }),
  data: datasetSchema,
}).superRefine((input, ctx) => {
  const { data, calendar, sessionDate } = input;
  const expected = [...data.sessions, sessionDate];
  const same = expected.length === calendar.sessions.length && expected.every((d, i) => d === calendar.sessions[i]);
  let calendarValid = true;
  try { validateCandles(calendar.sessions.map(date => ({ date, open: '1', high: '1', low: '1', close: '1', volume: '0' }))); }
  catch { calendarValid = false; }
  if (!same || !calendarValid || data.series.length !== 1 || data.series[0]?.symbol !== '005930'
    || createHash('sha256').update(JSON.stringify(data)).digest('hex') !== input.dataSha256) {
    ctx.addIssue({ code: 'custom', message: 'Invalid paper loop dataset/calendar/digest' });
  }
});
export type PaperLoopInput = z.infer<typeof paperLoopInputSchema>;
export function loopOrderKey(input: PaperLoopInput): string {
  return strategyOrderKey({ ...STRATEGY_IDENTITY, symbol: '005930',
    evaluatedAt: candleTime(input.data.sessions.at(-1)!, 'close') });
}
export function eligibleLoopSession(input: PaperLoopInput, now: Date): boolean {
  const lastBar = input.data.sessions.at(-1)!;
  const close = Date.parse(candleTime(lastBar, 'close'));
  // The reviewed calendar decides the next session; uncovered dates are never eligible.
  return isPaperOrderSession(now) && seoulOrderDate(now.toISOString()) === input.sessionDate
    && nextKrxSession(lastBar) === input.sessionDate
    && now.getTime() >= close && now.getTime() - close <= 96 * 3600000;
}
