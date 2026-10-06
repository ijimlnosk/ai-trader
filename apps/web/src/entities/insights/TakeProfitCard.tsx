'use client';
import { formatKrw, formatSeoulTime } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { useInsights } from './queries';

/** Dry-run take-profit crossings (+30% over the average purchase price). No order is ever sent from these. */
export function TakeProfitCard() {
  const query = useInsights();
  const items = query.data?.takeProfit ?? [];
  return (
    <Card title="익절 감시 (기록만)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="🎯">아직 +30%에 도달한 보유 종목이 없어요</Empty> : (
        <ul className="rows">{items.map((item) => (
          <li className="row" key={`${item.symbol}-${item.sessionDate}`}>
            <div className="row-main">
              <strong>{item.name} +{(item.gainBps / 100).toFixed(2)}%</strong>
              <span className="subtle">평균 매입가 {formatKrw(item.averagePrice)} → {formatKrw(item.price)}</span>
            </div>
            <div className="row-end"><span className="subtle">{formatSeoulTime(item.detectedAt)}</span></div>
          </li>))}
        </ul>)}
      <p className="footnote">장중 1분마다 확인해요. 실제 매도 주문은 내지 않고, 검증이 끝나면 따로 승인 후 켜요.</p>
    </Card>
  );
}
