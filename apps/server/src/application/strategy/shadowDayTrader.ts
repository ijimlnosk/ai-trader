import { seoulOrderDate } from '../../domain/orders.ts';
import { DECIMAL_SCALE, parseRiskDecimal } from '../../domain/risk/decimal.ts';
import { krxSessionStatus } from '../../domain/scheduler/krxCalendar.ts';
import { buyFill, closeDecision, DAY_V1, exitReason, isRebuy, morningWatchlist, sellFill, type DayConfig, type MorningQuote } from '../../domain/strategy/dayTrading.ts';
import { replayShadow, type ShadowTrade } from '../../domain/strategy/shadowLedger.ts';
import type { MarketBroker } from '../market.ts';

// 09:04–09:10 is kept free of virtual-trading quote calls: production momentum orders run at 09:05 and share the
// provider's per-second limit (EGW00201 observed 2026-10-07 when both clients were busy).
const SWEEP_START = 9 * 60 + 1, QUIET_START = 9 * 60 + 4, SWEEP_END = 14 * 60 + 30, TRADE_START = 9 * 60 + 10, ENTRY_END = 15 * 60;
const CLOSE_DECISION = 15 * 60 + 15, END = 15 * 60 + 20, MAX_QUOTE_AGE_MS = 10_000;

export interface ShadowTradeRepository {
  list(strategy: string): Promise<ShadowTrade[]>;
  record(strategy: string, trade: ShadowTrade): Promise<void>;
}

/**
 * Virtual intraday trading on live quotes (order-free): never creates a proposal or order. Every virtual fill is
 * persisted; cash and holdings are replayed from them each step, so a restart keeps the ledger (only the in-memory
 * highs and the watchlist are rebuilt). Stale or failed quotes are skipped.
 */
export function createShadowDayTrader(deps: { market: Pick<MarketBroker, 'getQuote'>; trades: ShadowTradeRepository; symbols: readonly string[];
  report: (event: string, detail?: Record<string, string>) => void; config?: DayConfig; now?: () => Date }) {
  const config = deps.config ?? DAY_V1; const now = deps.now ?? (() => new Date());
  const state = { date: '', watchlist: null as string[] | null, first: new Map<string, bigint>(), highSeen: new Map<string, bigint>(),
    highSinceEntry: new Map<string, bigint>(), closeDecided: new Set<string>() };
  const quote = async (symbol: string) => {
    const q = await deps.market.getQuote(symbol).catch(() => null);
    const age = q ? now().getTime() - Date.parse(q.timestamp) : NaN;
    const price = q ? parseRiskDecimal(q.price) : null; const change = q ? parseRiskDecimal(q.changeRate) : null; const volume = q ? parseRiskDecimal(q.volume) : null;
    if (!q || q.symbol !== symbol || !(age >= 0 && age <= MAX_QUOTE_AGE_MS) || !price || price <= 0n || change === null || volume === null) return null;
    return { symbol, price: price / DECIMAL_SCALE, changeBps: change * 100n / DECIMAL_SCALE, volume: volume / DECIMAL_SCALE } satisfies MorningQuote;
  };
  return async () => {
    const at = now(); const today = seoulOrderDate(at.toISOString());
    const seoul = new Date(at.getTime() + 9 * 3600000); const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
    if (krxSessionStatus(today) !== 'session' || minute < SWEEP_START || minute >= END) return;
    if (state.date !== today) Object.assign(state, { date: today, watchlist: null, first: new Map(), highSeen: new Map(), highSinceEntry: new Map(), closeDecided: new Set() });
    if (!state.watchlist) {
      if (minute >= SWEEP_END) return;
      const quotes: MorningQuote[] = [];
      if (minute >= QUIET_START && minute < TRADE_START) return;
      for (const symbol of deps.symbols) {
        const at2 = new Date(now().getTime() + 9 * 3600000); const current = at2.getUTCHours() * 60 + at2.getUTCMinutes();
        // A sweep that reaches the quiet window stops and uses the quotes it has.
        if (current >= QUIET_START && current < TRADE_START) break;
        const q = await quote(symbol); if (q) { quotes.push(q); state.first.set(symbol, q.price); }
      }
      state.watchlist = morningWatchlist(quotes, config);
      return deps.report('shadow_watchlist', { quoted: String(quotes.length), symbols: state.watchlist.join(',') });
    }
    if (minute < TRADE_START) return;
    const trades = await deps.trades.list(config.id);
    const ledger = replayShadow(config.capitalKrw, trades);
    let cash = ledger.cashKrw; const held = new Set(ledger.holdings.map((h) => h.symbol)); const soldNow = new Set<string>();
    const record = async (trade: Omit<ShadowTrade, 'sessionDate' | 'createdAt'>) => {
      await deps.trades.record(config.id, { ...trade, sessionDate: today, createdAt: now().toISOString() });
      deps.report('shadow_trade', { symbol: trade.symbol, side: trade.side, quantity: String(trade.quantity), price: String(trade.fillPrice), reason: trade.reason });
    };
    for (const holding of ledger.holdings) {
      const q = await quote(holding.symbol); if (!q) continue;
      const high = [state.highSinceEntry.get(holding.symbol) ?? holding.entryPrice, q.price].reduce((a, b) => (a > b ? a : b));
      state.highSinceEntry.set(holding.symbol, high);
      let reason: string | null = exitReason(holding.entryPrice, high, q.price, config);
      if (!reason && minute >= CLOSE_DECISION && !state.closeDecided.has(holding.symbol)) {
        state.closeDecided.add(holding.symbol);
        if (closeDecision(holding.entryPrice, q.price, state.first.get(holding.symbol)) === 'SELL') reason = 'CLOSE';
      }
      if (!reason) continue;
      const fill = sellFill(q.price, holding.quantity);
      await record({ symbol: holding.symbol, side: 'SELL', quantity: holding.quantity, quotePrice: q.price, fillPrice: fill.fillPrice, feesKrw: fill.feesKrw, reason });
      cash += fill.proceedsKrw; held.delete(holding.symbol); soldNow.add(holding.symbol); state.highSinceEntry.delete(holding.symbol);
    }
    if (minute >= ENTRY_END) return;
    const todays = trades.filter((t) => t.sessionDate === today);
    for (const symbol of state.watchlist) {
      const free = config.maxPositions - held.size; if (free <= 0) break;
      if (held.has(symbol) || soldNow.has(symbol) || todays.filter((t) => t.symbol === symbol && t.side === 'BUY').length >= config.maxBuysPerSymbolPerDay) continue;
      const q = await quote(symbol); if (!q) continue;
      const isNewHigh = q.price >= (state.highSeen.get(symbol) ?? 0n);
      state.highSeen.set(symbol, isNewHigh ? q.price : state.highSeen.get(symbol)!);
      const lastSell = todays.filter((t) => t.symbol === symbol && t.side === 'SELL').at(-1);
      const wanted = lastSell ? isRebuy(lastSell.quotePrice, q.price, config)
        : isNewHigh && q.changeBps >= config.entryMinChangeBps && q.changeBps <= config.entryMaxChangeBps;
      if (!wanted) continue;
      const fill = buyFill(q.price, cash / BigInt(free)); if (fill.quantity <= 0n) continue;
      await record({ symbol, side: 'BUY', quantity: fill.quantity, quotePrice: q.price, fillPrice: fill.fillPrice, feesKrw: fill.feesKrw, reason: lastSell ? 'REBUY' : 'ENTRY' });
      cash -= fill.costKrw; held.add(symbol); state.highSinceEntry.set(symbol, fill.fillPrice);
    }
  };
}
