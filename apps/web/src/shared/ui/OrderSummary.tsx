import type { OrderResponse } from '@ai-trader/contracts';
import { formatDecimal, formatKrw } from '@/shared/lib/format';

/** Symbol, side, quantity, price and broker state for one paper order. */
export function OrderSummary({ order }: { order: OrderResponse }) {
  return (
    <span>
      <b className={order.side === 'BUY' ? 'buy' : 'sell'}>{order.side}</b> {order.symbol} {formatDecimal(order.quantity)}주 ·{' '}
      {order.brokerStatus} · 체결 {formatDecimal(order.filledQuantity)}주 / {formatKrw(order.filledAmount)}
      {order.brokerOrderId ? ` · KIS ${order.brokerOrderId}` : ''}
    </span>
  );
}
