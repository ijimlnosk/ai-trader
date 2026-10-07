import type { ConsoleInsightsResponse } from '@ai-trader/contracts';
import { universeName } from '../../domain/market/universe.ts';
import { DECIMAL_SCALE, parseRiskDecimal } from '../../domain/risk/decimal.ts';
import { DEFAULT_MOMENTUM_CONFIG, type MomentumEvaluation } from '../../domain/strategy/momentum.ts';
import type { StrategyRunRecord } from '../scheduler/index.ts';
import { MOMENTUM_PLAN_PREFIX } from '../strategy/momentumPlan.ts';
import { lowPriceName } from '../../domain/market/lowPriceUniverse.ts';
import { DAY_V1 } from '../../domain/strategy/dayTrading.ts';
import { replayShadow } from '../../domain/strategy/shadowLedger.ts';
import type { ShadowTradeRepository } from '../strategy/shadowDayTrader.ts';

type Collection = ConsoleInsightsResponse['collection'];

/** Bounded, newest-first reads for the insights view. */
export interface InsightReadRepository {
  dailyCoverage(sessions: number): Promise<Collection['daily']>;
  minuteCoverage(sessions: number): Promise<Collection['minute']>;
  recentDisclosures(limit: number): Promise<{ receiptNo: string; symbol: string; receiptDate: string; reportName: string }[]>;
  recentTakeProfit(limit: number): Promise<{ symbol: string; sessionDate: string; rule: string; averagePrice: string; price: string; gainBps: number; detectedAt: string }[]>;
}

/** Owner's planned live capital (2026-10-06). Display only: it changes no sizing or risk rule. */
export const OWNER_LIVE_CAPITAL_KRW = 500_000n;

function momentumView(run: StrategyRunRecord | null): ConsoleInsightsResponse['momentum'] {
  if (!run || run.result.evaluations.length === 0) return null;
  const budget = OWNER_LIVE_CAPITAL_KRW * BigInt(DEFAULT_MOMENTUM_CONFIG.allocationBps) / 10000n;
  const rows = run.result.evaluations.map(({ signal }) => {
    const evaluation = signal as unknown as MomentumEvaluation;
    const metrics = evaluation.metrics;
    const close = metrics ? parseRiskDecimal(metrics.close) : null;
    return { rank: metrics?.rank ?? null, symbol: evaluation.symbol, name: universeName(evaluation.symbol) ?? evaluation.symbol,
      reason: evaluation.reason, momentumPct: metrics ? Math.round(metrics.momentum * 1000) / 10 : null, close: metrics?.close ?? null,
      trendMa: metrics ? metrics.trendMa.toFixed(0) : null, heldQuantity: evaluation.heldQuantity,
      proposedQuantity: evaluation.proposal?.quantity ?? null, affordableSmall: close !== null && close > 0n && close <= budget * DECIMAL_SCALE };
  }).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.symbol.localeCompare(b.symbol));
  return { runKey: run.runKey, sessionDate: run.sessionDate, smallAccount: { capitalKrw: OWNER_LIVE_CAPITAL_KRW.toString(), budgetKrw: budget.toString() }, rows };
}

async function shadowView(trades: ShadowTradeRepository | undefined): Promise<ConsoleInsightsResponse['shadow']> {
  if (!trades) return null;
  const fills = await trades.list(DAY_V1.id);
  const ledger = replayShadow(DAY_V1.capitalKrw, fills);
  const name = (symbol: string) => lowPriceName(symbol) ?? universeName(symbol) ?? symbol;
  const days = [...ledger.days].sort(([a], [b]) => b.localeCompare(a)).slice(0, 20);
  return { strategy: DAY_V1.id, capitalKrw: DAY_V1.capitalKrw.toString(), cashKrw: ledger.cashKrw.toString(),
    realizedKrw: [...ledger.days.values()].reduce((sum, day) => sum + day.realizedKrw, 0n).toString(),
    holdings: ledger.holdings.map((h) => ({ symbol: h.symbol, name: name(h.symbol), quantity: h.quantity.toString(), costKrw: h.costKrw.toString(), entryPrice: h.entryPrice.toString() })),
    days: days.map(([sessionDate, day]) => ({ sessionDate, trades: day.trades, realizedKrw: day.realizedKrw.toString() })),
    recent: fills.slice(-30).reverse().map((t) => ({ sessionDate: t.sessionDate, symbol: t.symbol, name: name(t.symbol), side: t.side, quantity: t.quantity.toString(),
      fillPrice: t.fillPrice.toString(), reason: t.reason, createdAt: t.createdAt })) };
}

export function createInsightQuery(plans: { latestPlanRun(prefix: string): Promise<StrategyRunRecord | null> }, repository: InsightReadRepository,
  shadowTrades?: ShadowTradeRepository) {
  return async (): Promise<ConsoleInsightsResponse> => {
    const [run, daily, minute, disclosures, takeProfit, shadow] = await Promise.all([plans.latestPlanRun(MOMENTUM_PLAN_PREFIX),
      repository.dailyCoverage(5), repository.minuteCoverage(10), repository.recentDisclosures(40), repository.recentTakeProfit(20), shadowView(shadowTrades)]);
    const name = (symbol: string) => universeName(symbol) ?? symbol;
    return { momentum: momentumView(run), collection: { daily, minute },
      disclosures: disclosures.map((item) => ({ ...item, name: name(item.symbol) })),
      takeProfit: takeProfit.map((item) => ({ ...item, name: name(item.symbol) })), shadow };
  };
}
export type InsightQuery = ReturnType<typeof createInsightQuery>;
