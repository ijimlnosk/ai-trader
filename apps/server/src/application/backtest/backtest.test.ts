import { expect, it } from 'vitest';
import { runBacktest, DEFAULT_BACKTEST_SETTINGS } from './index.ts';
import { executeSimulation, validateCosts } from './execution.ts';
import { sampleDataset, prefix, flatAccount } from '../../../test/strategyFixtures.ts';
import { evaluateStrategy } from '../../domain/strategy/evaluate.ts';
import { ledgerAmount } from '../../domain/tradeLedger.ts';
import { accountSnapshot, type SimulationAccount } from './account.ts';
it('runs the default sample end to end with repeatable risk, trades and net ledger', () => {
  const data = sampleDataset();
  const result = runBacktest(data);
  expect(result).toEqual(runBacktest(data));
  expect(result.trades.some((t) => t.proposal.side === 'BUY' && t.status === 'FILLED')).toBe(true);
  expect(result.summary.completedTrades).toBeGreaterThan(0);
  expect(result.ledger.length).toBeGreaterThan(0);
  expect(result.trades.every((t) => t.status !== 'FILLED' || t.decision.approved)).toBe(true);
  expect(result.equityCurve.every((p) => ledgerAmount(p.cash) >= 0n)).toBe(true);
  const reversed = runBacktest({ ...data, series: [...data.series].reverse() });
  expect(reversed.trades).toEqual(result.trades);
});
it('fills close signals at the next session open and never fills the final signal', () => {
  const data = sampleDataset();
  const lastSignal = runBacktest(prefix(data, 99));
  expect(lastSignal.ledger).toHaveLength(0);
  expect(lastSignal.unfilledSignals.length).toBeGreaterThan(0);
  const next = runBacktest(prefix(data, 100));
  expect(next.trades.length).toBeGreaterThan(0);
  for (const trade of next.trades) {
    expect(trade.signal.evaluatedAt).toContain('T06:30:00.000Z');
    expect(trade.proposal.createdAt).toContain('T00:00:00.000Z');
    expect(trade.proposal.estimatedPrice).toBe(data.series.find((s) => s.symbol === trade.proposal.symbol)!.candles[99]!.open);
  }
});
it('future OHLCV cannot change earlier signals, risk decisions or opening executions', () => {
  const data = sampleDataset(); const changed = structuredClone(data);
  for (const series of changed.series) for (const bar of series.candles.slice(100)) {
    bar.open = '200000'; bar.high = '250000'; bar.low = '150000'; bar.close = '230000'; bar.volume = '999999';
  }
  // At the execution open, its later high/low/close and volume must also be invisible.
  for (const series of changed.series) {
    const bar = series.candles[99]!; bar.high = '250000'; bar.low = '1'; bar.close = '200000'; bar.volume = '999999';
  }
  const baseline = runBacktest(data); const result = runBacktest(changed);
  expect(result.evaluations.slice(0, 198)).toEqual(baseline.evaluations.slice(0, 198));
  expect(result.trades.slice(0, 2)).toEqual(baseline.trades.slice(0, 2));
});
it('kill switch rejects entries and never produces simulated executions', () => {
  const result = runBacktest(sampleDataset(), { ...DEFAULT_BACKTEST_SETTINGS, killSwitchEnabled: true });
  expect(result.ledger).toHaveLength(0);
  expect(result.evaluations.some((e) => e.decision && !e.decision.approved && e.decision.reasons.includes('KILL_SWITCH_ENABLED'))).toBe(true);
});
it('rechecks next-open risk on price gaps without reducing quantity to force approval', () => {
  const data = prefix(sampleDataset(), 100);
  for (const series of data.series) Object.assign(series.candles[99]!, { open: '500000', high: '500000', low: '500000', close: '500000' });
  const result = runBacktest(data);
  expect(result.trades.length).toBeGreaterThan(0);
  expect(result.trades.every((t) => t.reason === 'RISK_REJECTED')).toBe(true);
  expect(result.ledger).toHaveLength(0);
});
it('models fees, taxes, slippage and moving-average basis exactly', () => {
  const data = sampleDataset(); const series = data.series[0]!;
  const base = evaluateStrategy(series.symbol, series.candles.slice(0, 99), flatAccount, data.source);
  const account: SimulationAccount = { cash: ledgerAmount('100000'), executions: [], marks: new Map([[series.symbol, '100']]) };
  const costs = { commissionBps: 100, sellTaxBps: 200, slippageBps: 100 };
  const bar = { ...series.candles[99]!, open: '100' };
  const signal = { ...base, proposal: { ...base.proposal!, quantity: '10', estimatedPrice: '100' } };
  const buy = executeSimulation(account, signal, bar, costs, false);
  expect(buy).toMatchObject({ status: 'FILLED', grossAmount: '1010', fees: '10.1', settlementAmount: '1020.1' });
  const sell = executeSimulation(account, { ...signal, evaluatedAt: 'sell', proposal: { ...signal.proposal, side: 'SELL' } },
    { ...series.candles[100]!, open: '120' }, costs, false);
  expect(sell).toMatchObject({ status: 'FILLED', grossAmount: '1188', fees: '35.64', settlementAmount: '1152.36', realizedPnl: '132.26' });
  expect(account.cash).toBe(ledgerAmount('100132.26'));
});
it('execution refuses overselling and insufficient cash including costs', () => {
  const data = sampleDataset(); const series = data.series[0]!;
  const base = evaluateStrategy(series.symbol, series.candles.slice(0, 99), flatAccount, data.source);
  const account: SimulationAccount = { cash: ledgerAmount('100000'), executions: [], marks: new Map([[series.symbol, '100']]) };
  const bar = { ...series.candles[99]!, open: '100' };
  const signal = { ...base, proposal: { ...base.proposal!, side: 'SELL' as const, quantity: '1' } };
  expect(executeSimulation(account, signal, bar, DEFAULT_BACKTEST_SETTINGS.costs, false).reason).toBe('INSUFFICIENT_HOLDINGS');
  // Most equity is invested in another holding; cash barely covers pre-fee order notional.
  account.cash = ledgerAmount('100'); account.marks.set('000660', '10000');
  account.executions.push({ orderId: 'prior', symbol: '000660', side: 'BUY', quantity: '1', amount: '10000', tradeDate: data.sessions[0]! });
  const buy = { ...signal, proposal: { ...signal.proposal, side: 'BUY' as const } };
  expect(executeSimulation(account, buy, bar, { commissionBps: 1, sellTaxBps: 0, slippageBps: 0 }, false).reason).toBe('INSUFFICIENT_CASH_WITH_COSTS');
});
it('validates costs and initial funds', () => {
  expect(() => validateCosts({ commissionBps: -1, sellTaxBps: 0, slippageBps: 0 })).toThrow();
  expect(() => validateCosts({ commissionBps: 5000, sellTaxBps: 5000, slippageBps: 0 })).toThrow();
  expect(() => runBacktest(sampleDataset(), { ...DEFAULT_BACKTEST_SETTINGS, initialCash: '0' })).toThrow();
});
it('net realized losses feed the next risk context and reset daily P/L without resetting loss streak', () => {
  const account: SimulationAccount = { cash: ledgerAmount('9990'), marks: new Map(), executions: [
    { orderId: 'buy', symbol: '005930', side: 'BUY', tradeDate: '20250102', quantity: '1', amount: '110' },
    { orderId: 'sell', symbol: '005930', side: 'SELL', tradeDate: '20250103', quantity: '1', amount: '100' },
  ] };
  expect(accountSnapshot(account, '20250103', false).context).toMatchObject({ dailyRealizedPnl: '-10', consecutiveLosses: 1, openPositionCount: 0 });
  expect(accountSnapshot(account, '20250106', false).context).toMatchObject({ dailyRealizedPnl: '0', consecutiveLosses: 1 });
});
it('metrics reconcile with final cash, open positions and exact closed-trade amounts', () => {
  const result = runBacktest(sampleDataset(), { ...DEFAULT_BACKTEST_SETTINGS,
    costs: { commissionBps: 15, sellTaxBps: 20, slippageBps: 5 } });
  const filled = result.trades.filter((t) => t.status === 'FILLED');
  const cash = filled.reduce((value, t) => value + ledgerAmount(t.settlementAmount) * (t.proposal.side === 'BUY' ? -1n : 1n), ledgerAmount(result.summary.initialCash));
  expect(ledgerAmount(result.equityCurve.at(-1)!.cash)).toBe(cash);
  const sales = filled.filter((t) => t.proposal.side === 'SELL');
  expect(result.summary.completedTrades).toBe(sales.length);
  const winning = sales.filter((t) => !t.realizedPnl!.startsWith('-') && t.realizedPnl !== '0').length;
  expect(result.summary.winRate).toBe(winning / sales.length);
  const peakAndDrawdown = result.equityCurve.reduce((state, point) => {
    const equity = ledgerAmount(point.equity); const peak = equity > state.peak ? equity : state.peak;
    return { peak, drawdown: Math.max(state.drawdown, Number((peak - equity) * 100000000n / peak) / 100000000) };
  }, { peak: ledgerAmount(result.summary.initialCash), drawdown: 0 });
  expect(result.summary.maxDrawdown).toBe(peakAndDrawdown.drawdown);
});
