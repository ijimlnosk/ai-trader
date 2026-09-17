import { z } from 'zod';
import type { AccountBroker } from './portfolio.ts';
import type { RiskContextProvider } from './risk.ts';
import { parseRiskDecimal, type RiskContext } from '../domain/risk/index.ts';
import type { OrderRepository } from './orders/ports.ts';
import { seoulOrderDate } from '../domain/orders.ts';

const nonnegativeDecimal = z.string().refine((value) => {
  const decimal = parseRiskDecimal(value);
  return decimal !== null && decimal >= 0n;
});
const positiveDecimal = nonnegativeDecimal.refine((value) => parseRiskDecimal(value) !== 0n);
// Validate the portfolio fields consumed by risk; other valuation fields are adapter-owned.
export const riskPortfolioSchema = z.object({
  cash: nonnegativeDecimal,
  totalEvaluation: positiveDecimal,
  positions: z.array(z.object({
    symbol: z.string().length(6).regex(/^[0-9]{6}$/),
    quantity: positiveDecimal,
  })).refine((positions) => new Set(positions.map((position) => position.symbol)).size === positions.length),
});

export function createPaperPortfolioRiskContextProvider(broker: AccountBroker, ledger: Pick<OrderRepository, 'getTradeLedger'> | undefined,
  killSwitchEnabled = false, now = () => new Date(),
): RiskContextProvider {
  return {
    async getRiskContext(): Promise<RiskContext | null> {
      // Exceptions must propagate; missing or malformed account data never becomes initial capital.
      const result = riskPortfolioSchema.safeParse(await broker.getPortfolio());
      if (!result.success) return null;
      const portfolio = result.data;
      if (!ledger) return null;
      const state = await ledger.getTradeLedger(seoulOrderDate(now().toISOString()));
      if (state.positions.length !== portfolio.positions.length || portfolio.positions.some((position) =>
        parseRiskDecimal(state.positions.find((p) => p.symbol === position.symbol)?.quantity) !== parseRiskDecimal(position.quantity))) return null;
      return {
        // Paper v1 explicitly uses deposit cash as its cash proxy, not verified order buying power.
        cash: portfolio.cash,
        totalEquity: portfolio.totalEvaluation,
        openPositionCount: portfolio.positions.length,
        dailyRealizedPnl: state.dailyRealizedPnl,
        consecutiveLosses: state.consecutiveLosses,
        killSwitchEnabled,
      };
    },
  };
}
