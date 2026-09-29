import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BrokerError } from '../../../application/brokerError.ts';
import type { DailyHistorySource } from '../../../application/marketData/ports.ts';
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

/** Period D, raw prices (FID_ORG_ADJ_PRC=1). KIS returns at most the latest 100 bars of the range. */
export function createKisDailyHistory(session: Pick<KisSession, 'get'>, now = Date.now): DailyHistorySource {
  return {
    async getDailyHistory(symbol, from, through) {
      if (!/^\d{6}$/.test(symbol)) throw new BrokerError('invalid_symbol');
      if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(through) || from > through) throw new BrokerError('provider_invalid_response');
      const query = new URLSearchParams({ FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol, FID_INPUT_DATE_1: from,
        FID_INPUT_DATE_2: through, FID_PERIOD_DIV_CODE: 'D', FID_ORG_ADJ_PRC: '1' });
      const response = await session.get(`/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${query}`, TRANSACTION);
      const retrievedAt = new Date(now()).toISOString();
      const rows = parseKis(dailySchema, response.body).output2;
      const candles = rows.flatMap((row) => 'stck_oprc' in row ? [{ date: row.stck_bsop_date, open: row.stck_oprc,
        high: row.stck_hgpr, low: row.stck_lwpr, close: row.stck_clpr, volume: row.acml_vol }] : [])
        .sort((a, b) => a.date.localeCompare(b.date));
      if (candles.some((bar, i) => bar.date < from || bar.date > through || bar.date === candles[i - 1]?.date)) {
        throw new BrokerError('provider_invalid_response');
      }
      return { candles, retrievedAt, source: `KIS ${TRANSACTION} J daily raw retrieved ${retrievedAt}`,
        rawSha256: createHash('sha256').update(JSON.stringify(response.body)).digest('hex') };
    },
  };
}
