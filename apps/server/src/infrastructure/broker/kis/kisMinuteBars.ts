import { createHash } from 'node:crypto';
import { z } from 'zod';
import { BrokerError } from '../../../application/brokerError.ts';
import type { MinuteBarSource } from '../../../application/marketData/minuteBars.ts';
import type { KisSession } from './kisSession.ts';
import { parseKis } from './kisSchemas.ts';

const digits = z.string().regex(/^\d{1,16}$/);
const barSchema = z.object({ stck_bsop_date: z.string().regex(/^\d{8}$/), stck_cntg_hour: z.string().regex(/^\d{6}$/),
  stck_oprc: digits, stck_hgpr: digits, stck_lwpr: digits, stck_prpr: digits, cntg_vol: digits });
const pageSchema = z.object({ output2: z.array(z.union([barSchema, z.object({ stck_bsop_date: z.literal('').optional() })])).max(30) });

const TRANSACTION = 'FHKST03010200';

/** Today's minute bars (KRX J market), newest first, at most 30 ending at `through`. Raw KRW prices. */
export function createKisMinuteBars(session: Pick<KisSession, 'get'>): MinuteBarSource {
  return {
    async getMinuteBars(symbol, through) {
      if (!/^\d{6}$/.test(symbol)) throw new BrokerError('invalid_symbol');
      if (!/^\d{6}$/.test(through)) throw new BrokerError('provider_invalid_response');
      const query = new URLSearchParams({ FID_ETC_CLS_CODE: '', FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol,
        FID_INPUT_HOUR_1: through, FID_PW_DATA_INCU_YN: 'N' });
      const response = await session.get(`/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice?${query}`, TRANSACTION);
      const rows = parseKis(pageSchema, response.body).output2.flatMap((row) => 'stck_cntg_hour' in row ? [row] : []);
      const dates = new Set(rows.map((row) => row.stck_bsop_date));
      if (dates.size > 1 || new Set(rows.map((row) => row.stck_cntg_hour)).size !== rows.length
        || rows.some((row) => row.stck_cntg_hour > through)) throw new BrokerError('provider_invalid_response');
      return { date: rows[0]?.stck_bsop_date ?? '', source: `KIS ${TRANSACTION} J minute raw`,
        rawSha256: createHash('sha256').update(JSON.stringify(response.body)).digest('hex'),
        bars: rows.map((row) => ({ time: row.stck_cntg_hour, open: row.stck_oprc, high: row.stck_hgpr, low: row.stck_lwpr,
          close: row.stck_prpr, volume: row.cntg_vol })) };
    },
  };
}
