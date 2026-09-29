import type { OrderResponse } from '@ai-trader/contracts';
import { formatDecimal, formatKrw, formatSeoulTime, symbolName } from '@/shared/lib/format';
import { Chip } from '@/shared/ui/Chip';
import { ORDER_STATUS, SIDE_LABEL } from './labels';

/** One order as a touch-friendly row: side, symbol, quantity, fill and broker state. */
export function OrderRow({ order }: { order: OrderResponse }) {
  const status = ORDER_STATUS[order.brokerStatus];
  const filled = order.filledQuantity !== '0' && !/^0+(\.0+)?$/.test(order.filledQuantity);
  return (
    <li className="row">
      <span className={`side side-${order.side.toLowerCase()}`}>{SIDE_LABEL[order.side]}</span>
      <div className="row-main">
        <strong>{symbolName(order.symbol)} · {formatDecimal(order.quantity)}주</strong>
        <span className="subtle">{formatSeoulTime(order.createdAt)}{order.brokerOrderId ? ` · KIS ${order.brokerOrderId}` : ''}</span>
      </div>
      <div className="row-end">
        <strong className="num">{filled ? formatKrw(order.filledAmount) : formatKrw(order.requestedPrice)}</strong>
        <Chip tone={status.tone}>{status.label}</Chip>
        {!order.positionsSyncedAt && order.brokerStatus === 'FILLED' && <span className="subtle warn-text">잔고 반영 대기</span>}
      </div>
    </li>
  );
}
