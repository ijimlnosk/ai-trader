import { z } from 'zod';
import { decimalString } from './kisSchemas.ts';

const nonnegative = decimalString.refine((value) => !value.startsWith('-'));
const quantity = z.string().max(64).regex(/^[0-9]+$/).refine((value) => value.trim() === value);
export const accountSchema = z.object({
  accountNo: z.string().length(8).regex(/^[0-9]{8}$/),
  accountProductCode: z.string().length(2).regex(/^[0-9]{2}$/),
});
export const portfolioSummarySchema = z.object({
  dnca_tot_amt: decimalString,
  tot_evlu_amt: decimalString,
  pchs_amt_smtl_amt: nonnegative,
  evlu_pfls_smtl_amt: decimalString,
});
export const portfolioPageSchema = z.object({
  output1: z.array(z.object({
    pdno: z.string().min(1).max(32).refine((value) => value.trim() === value),
    prdt_name: z.string().trim().min(1).max(200),
    hldg_qty: quantity,
    ord_psbl_qty: quantity,
    pchs_avg_pric: nonnegative,
    prpr: nonnegative,
    evlu_amt: nonnegative,
    evlu_pfls_amt: decimalString,
    evlu_pfls_rt: decimalString,
  })),
  // Missing summary is distinct from an empty holdings list.
  output2: z.array(portfolioSummarySchema).max(1).optional(),
  ctx_area_fk100: z.string().max(100).optional(),
  ctx_area_nk100: z.string().max(100).optional(),
});
export type KisPortfolioSummary = z.infer<typeof portfolioSummarySchema>;
export type KisPortfolioPage = z.infer<typeof portfolioPageSchema>;
