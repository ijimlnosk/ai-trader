import type { TradeProposal } from '../risk/index.ts';
import { ledgerAmount } from '../tradeLedger.ts';
import { DECIMAL_SCALE } from '../risk/decimal.ts';
import { strategyConfigId, DEFAULT_STRATEGY_CONFIG, type StrategyConfig } from './config.ts';
import { indicators, type Indicators } from './indicators.ts';
import { candleTime, type DailyCandle } from './marketData.ts';
import { screenSymbol, type ScreenResult } from './screener.ts';
export interface StrategyEvaluation {
  strategyId: 'ema-cross'; version: '1'; configId: string; symbol: string; evaluatedAt: string;
  source: string; screen: ScreenResult; indicators: Indicators | null; reason: string; proposal: TradeProposal | null;
}
export interface StrategyAccount { cash: string; totalEquity: string; heldQuantity: string }
export function evaluateStrategy(symbol: string, candles: readonly DailyCandle[], account: StrategyAccount,
  source: string, config: Readonly<StrategyConfig> = DEFAULT_STRATEGY_CONFIG): StrategyEvaluation {
  const configId = strategyConfigId(config);
  if (!/^\d{6}$/.test(symbol) || !source.trim()) throw new Error('Invalid strategy input');
  const cash = ledgerAmount(account.cash); const equity = ledgerAmount(account.totalEquity);
  const held = ledgerAmount(account.heldQuantity);
  if (held % DECIMAL_SCALE !== 0n || equity <= 0n) throw new Error('Invalid strategy account');
  const screen = screenSymbol(symbol, candles, config); const values = indicators(candles);
  const bar = candles.at(-1);
  const result: StrategyEvaluation = { strategyId: 'ema-cross', version: '1', configId, symbol,
    evaluatedAt: bar ? candleTime(bar.date, 'close') : '', source, screen, indicators: values,
    reason: 'INSUFFICIENT_HISTORY', proposal: null };
  if (!values || !bar) return result;
  let side: 'BUY' | 'SELL'; let quantity: bigint;
  if (held > 0n) {
    if (values.ema20 > values.ema60 && Number(bar.close) >= values.ema60) return { ...result, reason: 'HOLD_POSITION' };
    side = 'SELL'; quantity = held / DECIMAL_SCALE;
  } else {
    if (!screen.included) return { ...result, reason: 'SCREENED_OUT' };
    if (!(values.previousEma20 <= values.previousEma60 && values.ema20 > values.ema60 && values.trend === 'up'
      && values.rsi14 >= config.minRsi && values.rsi14 <= config.maxRsi
      && values.volumeRatio !== null && values.volumeRatio >= config.minVolumeRatio)) return { ...result, reason: 'NO_ENTRY' };
    // Indicators are approximate; conservatively round volatility budget up to fixed-scale KRW.
    const riskPerShare = Math.ceil(values.atr14 * config.atrMultiple * Number(DECIMAL_SCALE));
    if (!Number.isSafeInteger(riskPerShare) || riskPerShare <= 0) return { ...result, reason: 'INVALID_VOLATILITY' };
    const volatilitySize = equity * BigInt(config.riskBudgetBps) / (10000n * BigInt(riskPerShare));
    const allocation = equity * BigInt(config.maxAllocationBps) / 10000n;
    const budget = cash < allocation ? cash : allocation;
    const cashSize = budget / ledgerAmount(bar.close);
    quantity = volatilitySize < cashSize ? volatilitySize : cashSize;
    if (quantity === 0n || quantity > 999999999n) return { ...result, reason: 'SIZE_UNAVAILABLE' };
    side = 'BUY';
  }
  return { ...result, reason: side === 'BUY' ? 'BULLISH_CROSS' : 'TREND_EXIT', proposal: {
    symbol, side, quantity: quantity.toString(), estimatedPrice: bar.close, confidence: '1', createdAt: result.evaluatedAt,
  } };
}
