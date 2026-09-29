'use client';
import { Card, Empty } from '@/shared/ui/Card';
import { OrderRow } from './OrderRow';
import { useOrders } from './queries';

export function OrdersList() {
  const query = useOrders();
  const items = query.data?.items ?? [];
  return (
    <Card title="주문 내역" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="🧾">아직 주문이 없어요</Empty>
        : <ul className="rows">{items.map((order) => <OrderRow key={order.id} order={order} />)}</ul>}
      <p className="footnote">금액은 체결 금액(미체결이면 요청가) 기준 · 수수료·세금 제외</p>
    </Card>
  );
}
