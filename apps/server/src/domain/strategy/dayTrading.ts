/**
 * Virtual intraday rules `day-v1` for a KRW 500,000 account (owner direction, 2026-10-07). Pure: prices and money
 * are whole KRW as bigint, rates in basis points. Values are starting points to be changed on recorded results.
 */
export const DAY_V1 = Object.freeze({
  id: 'day-v1', capitalKrw: 500_000n, maxPositions: 3, watchlistSize: 12,
  /** Morning strength band for new entries: change since the previous close. */
  entryMinChangeBps: 100n, entryMaxChangeBps: 800n,
  targetBps: 500n, trailArmBps: 300n, trailDropBps: 150n, stopBps: 300n,
  rebuyDropBps: 200n, maxBuysPerSymbolPerDay: 4,
});
export type DayConfig = typeof DAY_V1;

/** Per fill: commission 2 bp each side, sell tax 20 bp, slippage 10 bp against us. */
export const DAY_COSTS = Object.freeze({ commissionBps: 2n, sellTaxBps: 20n, slippageBps: 10n });

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export function buyFill(quotePrice: bigint, budgetKrw: bigint) {
  const fillPrice = ceilDiv(quotePrice * (10000n + DAY_COSTS.slippageBps), 10000n);
  let quantity = budgetKrw * 10000n / (fillPrice * (10000n + DAY_COSTS.commissionBps));
  const fees = (q: bigint) => ceilDiv(q * fillPrice * DAY_COSTS.commissionBps, 10000n);
  while (quantity > 0n && quantity * fillPrice + fees(quantity) > budgetKrw) quantity -= 1n;
  return { quantity, fillPrice, feesKrw: fees(quantity), costKrw: quantity * fillPrice + fees(quantity) };
}

export function sellFill(quotePrice: bigint, quantity: bigint) {
  const fillPrice = quotePrice * (10000n - DAY_COSTS.slippageBps) / 10000n;
  const gross = quantity * fillPrice;
  const feesKrw = ceilDiv(gross * (DAY_COSTS.commissionBps + DAY_COSTS.sellTaxBps), 10000n);
  return { fillPrice, feesKrw, proceedsKrw: gross - feesKrw };
}

export type ExitReason = 'TARGET' | 'TRAIL' | 'STOP';

/** Exit test for a held position against its entry fill and the highest quote seen since entry. */
export function exitReason(entryPrice: bigint, highSinceEntry: bigint, price: bigint, config: DayConfig = DAY_V1): ExitReason | null {
  if (price * 10000n >= entryPrice * (10000n + config.targetBps)) return 'TARGET';
  if (highSinceEntry * 10000n >= entryPrice * (10000n + config.trailArmBps) && price * 10000n <= highSinceEntry * (10000n - config.trailDropBps)) return 'TRAIL';
  if (price * 10000n <= entryPrice * (10000n - config.stopBps)) return 'STOP';
  return null;
}

/** 15:15 decision: take winners; hold a loser overnight only if it trades at or above the session's first price. */
export function closeDecision(entryPrice: bigint, price: bigint, sessionFirstPrice: bigint | undefined): 'SELL' | 'HOLD' {
  if (price > entryPrice) return 'SELL';
  return sessionFirstPrice !== undefined && price >= sessionFirstPrice ? 'HOLD' : 'SELL';
}

export interface MorningQuote { symbol: string; price: bigint; changeBps: bigint; volume: bigint }

/** Watchlist: within the strength band, ranked by traded value so far today. */
export function morningWatchlist(quotes: readonly MorningQuote[], config: DayConfig = DAY_V1): string[] {
  return quotes.filter((q) => q.changeBps >= config.entryMinChangeBps && q.changeBps <= config.entryMaxChangeBps)
    .sort((a, b) => (b.price * b.volume > a.price * a.volume ? 1 : b.price * b.volume < a.price * a.volume ? -1 : a.symbol.localeCompare(b.symbol)))
    .slice(0, config.watchlistSize).map((q) => q.symbol);
}

/** Re-buy after a profitable or stopped sale once the price is `rebuyDropBps` below that sale. */
export const isRebuy = (lastSellPrice: bigint, price: bigint, config: DayConfig = DAY_V1) =>
  price * 10000n <= lastSellPrice * (10000n - config.rebuyDropBps);
