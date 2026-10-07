/** One virtual fill. Whole KRW and whole shares. */
export interface ShadowTrade {
  sessionDate: string; symbol: string; side: 'BUY' | 'SELL'; quantity: bigint; quotePrice: bigint; fillPrice: bigint;
  feesKrw: bigint; reason: string; createdAt: string;
}

export interface ShadowHolding { symbol: string; quantity: bigint; costKrw: bigint; entryPrice: bigint; entryDate: string }

/** Replays fills in order into cash, holdings and realized results per session (fees included). */
export function replayShadow(capitalKrw: bigint, trades: readonly ShadowTrade[]) {
  let cash = capitalKrw;
  const holdings = new Map<string, ShadowHolding>();
  const days = new Map<string, { trades: number; realizedKrw: bigint }>();
  for (const trade of trades) {
    const day = days.get(trade.sessionDate) ?? { trades: 0, realizedKrw: 0n };
    day.trades += 1;
    if (trade.side === 'BUY') {
      const cost = trade.quantity * trade.fillPrice + trade.feesKrw;
      cash -= cost;
      const held = holdings.get(trade.symbol);
      if (held) Object.assign(held, { quantity: held.quantity + trade.quantity, costKrw: held.costKrw + cost });
      else holdings.set(trade.symbol, { symbol: trade.symbol, quantity: trade.quantity, costKrw: cost, entryPrice: trade.fillPrice, entryDate: trade.sessionDate });
    } else {
      const held = holdings.get(trade.symbol);
      if (!held || held.quantity < trade.quantity) throw new Error('shadow_ledger_inconsistent');
      const proceeds = trade.quantity * trade.fillPrice - trade.feesKrw;
      const basis = held.costKrw * trade.quantity / held.quantity;
      cash += proceeds;
      day.realizedKrw += proceeds - basis;
      if (held.quantity === trade.quantity) holdings.delete(trade.symbol);
      else Object.assign(held, { quantity: held.quantity - trade.quantity, costKrw: held.costKrw - basis });
    }
    days.set(trade.sessionDate, day);
  }
  return { cashKrw: cash, holdings: [...holdings.values()], days };
}
