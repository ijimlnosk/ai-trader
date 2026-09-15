import type { Portfolio, Position } from '../../../domain/portfolio.ts';
import { portfolioProfitLossRate } from '../../../domain/portfolioProfitLossRate.ts';
import { BrokerError } from '../../../application/brokerError.ts';
import type { KisPortfolioPage, KisPortfolioSummary } from './kisPortfolioSchemas.ts';

export function mapPosition(row: KisPortfolioPage['output1'][number]): Position {
  if (BigInt(row.ord_psbl_qty) > BigInt(row.hldg_qty)) throw new BrokerError('provider_invalid_response');
  return {
    symbol: row.pdno, name: row.prdt_name, quantity: row.hldg_qty,
    availableQuantity: row.ord_psbl_qty, averagePrice: row.pchs_avg_pric,
    currentPrice: row.prpr, evaluationAmount: row.evlu_amt,
    profitLoss: row.evlu_pfls_amt, profitLossRate: row.evlu_pfls_rt,
  };
}

export function mapPortfolio(summary: KisPortfolioSummary, positions: Position[]): Portfolio {
  const rate = portfolioProfitLossRate(summary.evlu_pfls_smtl_amt, summary.pchs_amt_smtl_amt);
  if (rate === null) throw new BrokerError('provider_invalid_response');
  return {
    cash: summary.dnca_tot_amt, totalEvaluation: summary.tot_evlu_amt,
    totalPurchaseAmount: summary.pchs_amt_smtl_amt, totalProfitLoss: summary.evlu_pfls_smtl_amt,
    totalProfitLossRate: rate, positions,
  };
}
