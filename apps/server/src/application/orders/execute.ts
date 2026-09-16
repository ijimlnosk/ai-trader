import { DEFAULT_RISK_POLICY, evaluateRisk, parseRiskDecimal } from '../../domain/risk/index.ts';
import { isPaperOrderSession, seoulOrderDate, type CreateOrderRequest, type StoredOrder } from '../../domain/orders.ts';
import type { MarketBroker } from '../market.ts';
import type { AccountBroker } from '../portfolio.ts';
import { createPaperPortfolioRiskContextProvider } from '../paperRiskContext.ts';
import { OrderError, type OrderBroker, type OrderRepository } from './ports.ts';
import { orderInputSchema, validAmount } from './input.ts';

export interface ExecutionDependencies {
  repository: OrderRepository;
  market: MarketBroker;
  account: AccountBroker;
  broker: OrderBroker;
  enabled: boolean;
  killSwitchEnabled: boolean;
  now?: () => Date;
}

export function createOrderExecution(deps: ExecutionDependencies) {
  const now = deps.now ?? (() => new Date());
  return async (key: string, input: CreateOrderRequest): Promise<StoredOrder> => {
    if (!deps.enabled) throw new OrderError('execution_disabled');
    const request = orderInputSchema.parse(input);
    const reserved = await deps.repository.reserve(key, request);
    if (!reserved.created) return reserved.order; // Never re-price, re-evaluate or re-submit a replay.
    let order = reserved.order;
    const fail = (failureCode: string) => deps.repository.update(order, { brokerStatus: 'FAILED', failureCode });
    try {
      if (!isPaperOrderSession(now())) return await fail('market_session_closed');
      const portfolio = await deps.account.getPortfolio();
      const context = await createPaperPortfolioRiskContextProvider({ getPortfolio: async () => portfolio }).getRiskContext();
      if (!context) return await fail('invalid_context');
      context.killSwitchEnabled = deps.killSwitchEnabled;
      const quote = await deps.market.getQuote(request.symbol);
      const fresh = () => {
        const age = now().getTime() - Date.parse(quote.timestamp);
        return Number.isFinite(age) && age >= 0 && age <= 10_000;
      };
      if (quote.symbol !== request.symbol || !validAmount(quote.price, true) || !fresh()) return await fail('invalid_quote');
      const position = portfolio.positions.find((item) => item.symbol === request.symbol);
      if (request.side === 'SELL' && (!position || !validAmount(position.availableQuantity)
        || parseRiskDecimal(position.availableQuantity)! < parseRiskDecimal(request.quantity)!)) return await fail('insufficient_sellable_quantity');
      if (request.side === 'BUY') {
        const power = await deps.broker.getBuyingPower(request.symbol, quote.price);
        if (!validAmount(power.cash) || !validAmount(power.quantity)) return await fail('invalid_buying_power');
        context.cash = power.cash;
        if (parseRiskDecimal(power.quantity)! < parseRiskDecimal(request.quantity)!) return await fail('insufficient_buying_power');
      }
      const proposal = { ...request, estimatedPrice: quote.price, createdAt: now().toISOString() };
      const decision = evaluateRisk(proposal, context);
      order = await deps.repository.update(order, {
        requestedPrice: quote.price, riskStatus: decision.approved ? 'approved' : 'rejected', riskReasons: decision.reasons,
        audit: { proposal, context, policy: DEFAULT_RISK_POLICY, decision, evaluatedAt: now().toISOString(), quoteReceivedAt: quote.timestamp,
          positionQuantityBefore: position?.quantity ?? '0' },
        ...(!decision.approved ? { brokerStatus: 'RISK_REJECTED' as const } : {}),
      });
      if (!decision.approved) return order;
      if (!fresh() || !isPaperOrderSession(now())) return await fail('quote_or_session_expired');
      // This durable transition must commit before the only broker write call.
      order = await deps.repository.update(order, { brokerStatus: 'SUBMITTING', brokerOrderDate: seoulOrderDate(now().toISOString()) });
      if (!fresh() || !isPaperOrderSession(now())) return await fail('quote_or_session_expired');
    } catch {
      // No broker write occurred. If DB itself fails, PREPARING remains and blocks further orders.
      return fail('order_context_unavailable');
    }
    let result;
    try {
      result = await deps.broker.submitOrder({ orderId: order.id, symbol: order.symbol, side: order.side,
        quantity: order.quantity, orderType: 'MARKET' });
    } catch {
      // Timeout, malformed success or connection failure may follow broker acceptance.
      return deps.repository.update(order, { brokerStatus: 'UNKNOWN', failureCode: 'submission_outcome_unknown' });
    }
    // A failed result write leaves SUBMITTING durable: replay never sends again.
    return deps.repository.update(order, result.accepted
      ? { brokerStatus: 'SUBMITTED', brokerOrderId: result.brokerOrderId }
      : { brokerStatus: 'BROKER_REJECTED', failureCode: 'broker_rejected' });
  };
}
