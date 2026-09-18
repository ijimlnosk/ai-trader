import { DEFAULT_RISK_POLICY, evaluateRisk } from '../../domain/risk/index.ts';
import { ledgerAmount, ledgerDecimal } from '../../domain/tradeLedger.ts';
import { DEFAULT_STRATEGY_CONFIG, validateStrategyConfig, type StrategyConfig } from '../../domain/strategy/config.ts';
import { evaluateStrategy, type StrategyEvaluation } from '../../domain/strategy/evaluate.ts';
import { validateDataset, type MarketDataset } from '../../domain/strategy/marketData.ts';
import { accountSnapshot, type SimulationAccount } from './account.ts';
import { executeSimulation, validateCosts, type SimulationCosts, type SimulatedExecution } from './execution.ts';
export interface BacktestSettings {
  initialCash: string; costs: SimulationCosts; strategy: StrategyConfig; killSwitchEnabled: boolean;
}
export const DEFAULT_BACKTEST_SETTINGS: Readonly<BacktestSettings> = Object.freeze({
  initialCash: '10000000', costs: Object.freeze({ commissionBps: 0, sellTaxBps: 0, slippageBps: 0 }),
  strategy: DEFAULT_STRATEGY_CONFIG, killSwitchEnabled: false,
});
export function validateBacktestSettings(settings: BacktestSettings): void {
  validateStrategyConfig(settings.strategy); validateCosts(settings.costs);
  if (ledgerAmount(settings.initialCash) <= 0n || typeof settings.killSwitchEnabled !== 'boolean') throw new Error('Invalid backtest account');
}
export function runBacktest(data: MarketDataset, settings: BacktestSettings = DEFAULT_BACKTEST_SETTINGS) {
  validateDataset(data); validateBacktestSettings(settings);
  const initial = ledgerAmount(settings.initialCash);
  const account: SimulationAccount = { cash: initial, executions: [], marks: new Map() };
  const universe = [...data.series].sort((a, b) => a.symbol < b.symbol ? -1 : 1);
  const trades: SimulatedExecution[] = [];
  const evaluations = [];
  const equityCurve: { date: string; cash: string; equity: string }[] = [];
  let pending: StrategyEvaluation[] = [];
  let peak = initial; let maxDrawdown = 0;
  for (let index = 0; index < data.sessions.length; index++) {
    const date = data.sessions[index]!;
    // Opening marks only: no current close/high/low enters execution or its risk context.
    for (const series of universe) account.marks.set(series.symbol, series.candles[index]!.open);
    for (const signal of pending) {
      const series = universe.find((item) => item.symbol === signal.symbol)!;
      trades.push(executeSimulation(account, signal, series.candles[index]!, settings.costs, settings.killSwitchEnabled));
    }
    pending = [];
    for (const series of universe) account.marks.set(series.symbol, series.candles[index]!.close);
    const snapshot = accountSnapshot(account, date, settings.killSwitchEnabled);
    for (const series of universe) {
      const heldQuantity = snapshot.ledger.positions.find((p) => p.symbol === series.symbol)?.quantity ?? '0';
      const signal = evaluateStrategy(series.symbol, series.candles.slice(0, index + 1),
        { ...snapshot.context, heldQuantity }, data.source, settings.strategy);
      const decision = signal.proposal ? evaluateRisk(signal.proposal, snapshot.context) : null;
      evaluations.push({ signal, context: snapshot.context, policy: DEFAULT_RISK_POLICY, decision });
      if (decision?.approved) pending.push(signal);
    }
    equityCurve.push({ date, cash: snapshot.context.cash, equity: snapshot.context.totalEquity });
    if (snapshot.equity > peak) peak = snapshot.equity;
    maxDrawdown = Math.max(maxDrawdown, Number((peak - snapshot.equity) * 100000000n / peak) / 100000000);
  }
  const final = accountSnapshot(account, data.sessions.at(-1)!, settings.killSwitchEnabled);
  const sales = trades.filter((trade) => trade.status === 'FILLED' && trade.realizedPnl !== null);
  // Each strategy exit disposes of all shares; each successful SELL closes one trade.
  const realizedPnl = sales.reduce((sum, trade) => sum + signedAmount(trade.realizedPnl!), 0n);
  const wins = sales.filter((trade) => signedAmount(trade.realizedPnl!) > 0n).length;
  return { version: '1', input: { data, settings }, evaluations, trades, equityCurve, ledger: account.executions,
    openPositions: final.ledger.positions, unfilledSignals: pending.map((signal) => ({ signal, reason: 'NO_NEXT_SESSION' })),
    summary: { initialCash: settings.initialCash, finalEquity: ledgerDecimal(final.equity), realizedPnl: ledgerDecimal(realizedPnl),
      totalReturn: Number((final.equity - initial) * 100000000n / initial) / 100000000,
      maxDrawdown, completedTrades: sales.length, winRate: sales.length ? wins / sales.length : null } };
}
function signedAmount(value: string): bigint {
  return value.startsWith('-') ? -ledgerAmount(value.slice(1)) : ledgerAmount(value);
}
