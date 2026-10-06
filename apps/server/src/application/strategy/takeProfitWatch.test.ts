import { describe, expect, it, vi } from 'vitest';
import type { Portfolio, Position } from '../../domain/portfolio.ts';
import { createTakeProfitWatch, type IntradaySignal } from './takeProfitWatch.ts';

const at = (iso: string) => () => new Date(iso);
const position = (symbol: string, averagePrice: string, quantity = '4'): Position => ({ symbol, name: symbol, quantity,
  availableQuantity: quantity, averagePrice, currentPrice: averagePrice, evaluationAmount: '0', profitLoss: '0', profitLossRate: '0' });
const portfolio = (...positions: Position[]): Portfolio => ({ cash: '0', totalEvaluation: '0', totalPurchaseAmount: '0',
  totalProfitLoss: '0', totalProfitLossRate: '0', positions });

function setup(prices: Record<string, string>, positions: Position[], now = at('2026-10-06T01:00:00.000Z'), quoteAt = '2026-10-06T00:59:58.000Z') {
  const saved: IntradaySignal[] = [];
  const report = vi.fn();
  const getQuote = vi.fn(async (symbol: string) => ({ symbol, price: prices[symbol]!, change: '0', changeRate: '0', volume: '0', timestamp: quoteAt }));
  const watch = createTakeProfitWatch({ account: { getPortfolio: async () => portfolio(...positions) }, market: { getQuote }, report, now,
    signals: { record: async (signal) => { if (saved.some((s) => s.symbol === signal.symbol)) return false; saved.push(signal); return true; } } });
  return { watch, saved, report, getQuote };
}

describe('take profit watch (dry run)', () => {
  it('records each crossing once per session and never more', async () => {
    const { watch, saved, report, getQuote } = setup({ '066570': '298675', '034730': '600000' }, [position('066570', '229750'), position('034730', '579000', '1')]);
    await watch();
    await watch();
    expect(saved).toEqual([{ symbol: '066570', sessionDate: '20261006', rule: 'TAKE_PROFIT_30', averagePrice: '229750', price: '298675',
      quantity: '4', gainBps: 3000, quoteAt: '2026-10-06T00:59:58.000Z', detectedAt: '2026-10-06T01:00:00.000Z' }]);
    expect(report).toHaveBeenCalledTimes(1);
    expect(getQuote.mock.calls.map(([symbol]) => symbol)).toEqual(['066570', '034730', '034730']);
  });

  it.each([
    ['before 09:05', '2026-10-06T00:04:00.000Z'],
    ['from 15:20', '2026-10-06T06:20:00.000Z'],
    ['on a closure', '2026-10-09T01:00:00.000Z'],
  ])('does nothing %s', async (_name, iso) => {
    const { watch, saved, getQuote } = setup({ '066570': '400000' }, [position('066570', '229750')], at(iso));
    await watch();
    expect(saved).toEqual([]);
    expect(getQuote).not.toHaveBeenCalled();
  });

  it('skips stale quotes and empty positions', async () => {
    const stale = setup({ '066570': '400000' }, [position('066570', '229750')], at('2026-10-06T01:00:00.000Z'), '2026-10-06T00:59:49.000Z');
    await stale.watch();
    expect(stale.saved).toEqual([]);
    const empty = setup({ '066570': '400000' }, [position('066570', '229750', '0')]);
    await empty.watch();
    expect(empty.getQuote).not.toHaveBeenCalled();
  });

  it('reports failures and retries on the next step', async () => {
    const { watch, saved, report, getQuote } = setup({ '066570': '400000' }, [position('066570', '229750')]);
    getQuote.mockRejectedValueOnce(new Error('timeout'));
    await watch();
    expect(report).toHaveBeenCalledWith('take_profit_watch_failed', { stage: 'quote', symbol: '066570' });
    await watch();
    expect(saved).toHaveLength(1);
  });
});
