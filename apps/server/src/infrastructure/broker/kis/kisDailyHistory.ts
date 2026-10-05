import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BrokerError } from '../../../application/brokerError.ts';
import type { DailyHistorySource } from '../../../application/marketData/ports.ts';
import type { DailyCandle } from '../../../domain/strategy/marketData.ts';
import type { KisSession } from './kisSession.ts';
import { parseKis } from './kisSchemas.ts';

const digits = z.string().regex(/^\d{1,16}$/);
// KIS pads the list with empty objects when fewer bars exist; those rows have no business date.
const barSchema = z.union([
  z.object({ stck_bsop_date: z.string().regex(/^\d{8}$/), stck_oprc: digits, stck_hgpr: digits,
    stck_lwpr: digits, stck_clpr: digits, acml_vol: digits }),
  z.object({ stck_bsop_date: z.literal('').optional() }),
]);
const dailySchema = z.object({ output2: z.array(barSchema).max(100) });

const TRANSACTION = 'FHKST03010100';
const PAGE_BARS = 100;
// Three pages cover more than one calendar year of sessions; older bars beyond that are not needed.
const MAX_PAGES = 3;

function dayBefore(date: string): string {
  const value = new Date(Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6) - 1));
  return value.toISOString().slice(0, 10).replaceAll('-', '');
}

/**
 * Period D, raw prices (FID_ORG_ADJ_PRC=1). KIS returns at most the latest 100 bars of a range, so
 * older pages are requested by moving the range end before the oldest bar received.
 */
export function createKisDailyHistory(session: Pick<KisSession, 'get'>, now = Date.now): DailyHistorySource {
  return {
    async getDailyHistory(symbol, from, through) {
      if (!/^\d{6}$/.test(symbol)) throw new BrokerError('invalid_symbol');
      if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(through) || from > through) throw new BrokerError('provider_invalid_response');
      const bodies: unknown[] = [];
      const candles: DailyCandle[] = [];
      let retrievedAt = '';
      for (let end = through, page = 0; page < MAX_PAGES; page += 1) {
        const query = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_INPUT_DATE_1: from,
          FID_INPUT_DATE_2: end, FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1' });
        const response = await session.get(`/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${query}`, TRANSACTION);
        retrievedAt ||= new Date(now()).toISOString();
        bodies.push(response.body);
        const bars = parseKis(dailySchema, response.body).output2.flatMap((row) => 'stck_oprc' in row ? [{ date: row.stck_bsop_date,
          open: row.stck_oprc, high: row.stck_hgpr, low: row.stck_lwpr, close: row.stck_clpr, volume: row.acml_vol }] : [])
          .sort((a, b) => a.date.localeCompare(b.date));
        if (bars.some((bar) => bar.date < from || bar.date > end)) throw new BrokerError('provider_invalid_response');
        candles.unshift(...bars);
        if (bars.length < PAGE_BARS || bars[0]!.date <= from) break;
        end = dayBefore(bars[0]!.date);
      }
      if (candles.some((bar, i) => i > 0 && bar.date <= candles[i - 1]!.date)) throw new BrokerError('provider_invalid_response');
      const raw = bodies.length === 1 ? bodies[0] : bodies;
      return { candles, retrievedAt, source: `KIS ${TRANSACTION} J daily raw retrieved ${retrievedAt}`,
        rawSha256: createHash('sha256').update(JSON.stringify(raw)).digest('hex') };
    },
  };
}
