import { z } from 'zod';
import { parseRiskDecimal } from '../../../domain/risk/index.ts';

export const brokerId = z.string().min(1).max(20).regex(/^[0-9]+$/).refine((v) => /^[0-9]+$/.test(v) && BigInt(v) > 0n).transform((v) => BigInt(v).toString());
const shares = z.string().max(16).regex(/^[0-9]+$/);
const money = z.string().refine((v) => { const n = parseRiskDecimal(v); return n !== null && n >= 0n; });
export const orderReceiptSchema = z.object({ output: z.object({ ODNO: brokerId,
  KRX_FWDG_ORD_ORGNO: z.string().min(1).max(20).regex(/^[0-9]+$/), ORD_TMD: z.string().length(6).regex(/^[0-9]+$/) }) });
export const buyingPowerSchema = z.object({ output: z.object({ nrcvb_buy_amt: money, nrcvb_buy_qty: shares }) });
export const fillPageSchema = z.object({
  output1: z.array(z.object({ odno: brokerId, ord_dt: z.string().length(8).regex(/^[0-9]+$/),
    pdno: z.string().length(6).regex(/^[0-9]+$/), sll_buy_dvsn_cd: z.enum(['01', '02']),
    ord_dvsn_cd: z.literal('01'), ord_qty: shares, tot_ccld_qty: shares, tot_ccld_amt: money,
    cncl_yn: z.enum(['Y', 'N']), rjct_qty: shares,
  })),
  ctx_area_fk100: z.string().max(100).optional(), ctx_area_nk100: z.string().max(100).optional(),
});
