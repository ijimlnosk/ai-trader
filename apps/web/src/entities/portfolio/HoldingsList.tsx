'use client';
import { formatDecimal, formatKrw, formatSignedKrw, toneOf } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { usePortfolio } from './queries';

export function HoldingsList() {
  const query = usePortfolio();
  const positions = query.data?.positions ?? [];
  return (
    <Card title="보유 종목" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {positions.length === 0 ? <Empty icon="📭">보유 중인 종목이 없어요</Empty> : (
        <ul className="rows">{positions.map((p) => (
          <li className="row" key={p.symbol}>
            <div className="row-main">
              <strong>{p.name}</strong>
              <span className="subtle">{p.symbol} · {formatDecimal(p.quantity)}주 (매도가능 {formatDecimal(p.availableQuantity)}) · 평균 {formatKrw(p.averagePrice)}</span>
            </div>
            <div className="row-end">
              <strong className="num">{formatKrw(p.evaluationAmount)}</strong>
              <span className={`num tone-${toneOf(p.profitLoss)}`}>{formatSignedKrw(p.profitLoss)} ({formatDecimal(p.profitLossRate)}%)</span>
            </div>
          </li>))}
        </ul>)}
      <p className="footnote">예수금은 주문가능금액이 아니며, 평가손익은 아직 확정되지 않은 손익이에요.</p>
    </Card>
  );
}
