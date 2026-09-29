'use client';
import { useQuery } from '@tanstack/react-query';
import type { ConsoleList, OrderResponse } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';
import { formatKrw, formatSeoulTime } from '@/shared/lib/format';
import { Empty, Panel } from '@/shared/ui/Panel';
import { OrderSummary } from '@/shared/ui/OrderSummary';

export function OrdersPanel() {
  const query = useQuery({ queryKey: ['console', 'orders'], queryFn: () => fetchConsole<ConsoleList<OrderResponse>>('orders', 20), refetchInterval: 60000 });
  const items = query.data?.items ?? [];
  return (
    <Panel title="Paper 주문" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty>주문 없음</Empty> : (
        <table><thead><tr><th>생성</th><th>주문</th><th>요청가</th><th>리스크</th><th>포지션 동기화</th></tr></thead>
          <tbody>{items.map((o) => (
            <tr key={o.id}><td>{formatSeoulTime(o.createdAt)}</td><td><OrderSummary order={o} /></td><td>{formatKrw(o.requestedPrice)}</td>
              <td>{o.riskStatus}{o.riskReasons.length ? ` (${o.riskReasons.join(', ')})` : ''}</td>
              <td className={o.positionsSyncedAt ? '' : 'warn-text'}>{o.positionsSyncedAt ? formatSeoulTime(o.positionsSyncedAt) : '미동기화'}</td></tr>))}
          </tbody></table>)}
    </Panel>
  );
}
