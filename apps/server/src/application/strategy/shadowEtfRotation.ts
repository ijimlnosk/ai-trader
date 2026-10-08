import { seoulOrderDate } from '../../domain/orders.ts';
import { DECIMAL_SCALE, parseRiskDecimal } from '../../domain/risk/decimal.ts';
import { KRX_CALENDAR, krxSessionStatus, previousKrxSession } from '../../domain/scheduler/krxCalendar.ts';
import { buyFill, sellFill } from '../../domain/strategy/dayTrading.ts';
import { ETF_V1, rankEtfs, type EtfConfig } from '../../domain/strategy/etfRotation.ts';
import { isFirstSessionOfWeek } from '../../domain/strategy/momentum.ts';
import { replayShadow } from '../../domain/strategy/shadowLedger.ts';
import type { MarketBroker } from '../market.ts';
import type { DailyHistory, DailyHistorySource } from '../marketData/ports.ts';
import type { ShadowTradeRepository } from './shadowDayTrader.ts';

// After the 09:04–09:10 quiet window and the day trader's first entries; history calls share the KIS gate.
const START = 9 * 60 + 20, END = 14 * 60, MAX_QUOTE_AGE_MS = 10_000;

/**
 * Virtual (order-free) weekly ETF rotation. On the first session of each week, ranks ETFs on completed daily bars
 * through the previous session and records virtual sells/buys at live quotes in the shared shadow ledger. A week whose
 * session already has fills is never repeated (restart-safe). ETF sales carry no transaction tax.
 */
export function createShadowEtfRotation(deps: { history: DailyHistorySource; market: Pick<MarketBroker, 'getQuote'>; trades: ShadowTradeRepository;
  symbols: readonly string[]; report: (event: string, detail?: Record<string, string>) => void; config?: EtfConfig; now?: () => Date;
  /** Owner settings for today: disabled skips the week's rotation; config is the chosen preset. */
  settings?: (() => Promise<{ enabled: boolean; config: EtfConfig }>) | undefined }) {
  let config = deps.config ?? ETF_V1; const now = deps.now ?? (() => new Date());
  let doneDate = '';
  const price = async (symbol: string) => {
    const q = await deps.market.getQuote(symbol).catch(() => null);
    const age = q ? now().getTime() - Date.parse(q.timestamp) : NaN; const value = q ? parseRiskDecimal(q.price) : null;
    return q && q.symbol === symbol && age >= 0 && age <= MAX_QUOTE_AGE_MS && value && value > 0n ? value / DECIMAL_SCALE : null;
  };
  return async () => {
    const at = now(); const today = seoulOrderDate(at.toISOString()); const previous = previousKrxSession(today);
    const seoul = new Date(at.getTime() + 9 * 3600000); const minute = seoul.getUTCHours() * 60 + seoul.getUTCMinutes();
    if (doneDate === today || krxSessionStatus(today) !== 'session' || !previous || !isFirstSessionOfWeek(previous, today) || minute < START || minute >= END) return;
    const owner = deps.settings ? await deps.settings() : { enabled: true, config };
    if (!owner.enabled) { doneDate = today; return deps.report('shadow_etf_rotation_disabled'); }
    config = owner.config;
    const trades = await deps.trades.list(config.id);
    if (trades.some((t) => t.sessionDate === today)) { doneDate = today; return; }
    const series: { symbol: string; closes: number[] }[] = [];
    for (const symbol of deps.symbols) {
      const daily: DailyHistory | null = await deps.history.getDailyHistory(symbol, KRX_CALENDAR.from, previous).catch(() => null);
      if (daily?.candles.at(-1)?.date === previous) series.push({ symbol, closes: daily.candles.map((candle) => Number(candle.close)) });
    }
    const ranked = rankEtfs(series, config); const keep = new Set(ranked.slice(0, config.keepRanks));
    const ledger = replayShadow(config.capitalKrw, trades);
    let cash = ledger.cashKrw; const held = new Set(ledger.holdings.map((h) => h.symbol));
    const record = async (trade: Parameters<ShadowTradeRepository['record']>[1]) => {
      await deps.trades.record(config.id, trade);
      deps.report('shadow_etf_trade', { symbol: trade.symbol, side: trade.side, quantity: String(trade.quantity), price: String(trade.fillPrice) });
    };
    for (const holding of ledger.holdings.filter((h) => !keep.has(h.symbol))) {
      const quote = await price(holding.symbol); if (!quote) continue;
      const fill = sellFill(quote, holding.quantity, 0n);
      await record({ sessionDate: today, symbol: holding.symbol, side: 'SELL', quantity: holding.quantity, quotePrice: quote, fillPrice: fill.fillPrice,
        feesKrw: fill.feesKrw, reason: 'ROTATE_OUT', createdAt: now().toISOString() });
      cash += fill.proceedsKrw; held.delete(holding.symbol);
    }
    for (const symbol of ranked.slice(0, config.positions).filter((s) => !held.has(s))) {
      const free = config.positions - held.size; if (free <= 0) break;
      const quote = await price(symbol); if (!quote) continue;
      const fill = buyFill(quote, cash / BigInt(free)); if (fill.quantity <= 0n) continue;
      await record({ sessionDate: today, symbol, side: 'BUY', quantity: fill.quantity, quotePrice: quote, fillPrice: fill.fillPrice,
        feesKrw: fill.feesKrw, reason: 'ROTATE_IN', createdAt: now().toISOString() });
      cash -= fill.costKrw; held.add(symbol);
    }
    doneDate = today;
    deps.report('shadow_etf_rotation', { ranked: String(ranked.length), scanned: String(series.length), holdings: [...held].join(',') });
  };
}
