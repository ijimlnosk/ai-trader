'use client';
import { formatKrw, formatSeoulTime } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { useInsights } from './queries';

const RULES: Record<string, string> = { TAKE_PROFIT_5: '+5% 기준', TAKE_PROFIT_10: '+10% 기준', TAKE_PROFIT_30: '+30% 기준' };

/** Dry-run take-profit crossings (+5%, +10%, +30% over the average purchase price). No order is ever sent from these. */
export function TakeProfitCard() {
  const query = useInsights();
  const items = query.data?.takeProfit ?? [];
  return (
    <Card title="익절 감시 (기록만)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="🎯">아직 +5% 이상 오른 보유 종목이 없어요</Empty> : (
        <ul className="rows">{items.map((item) => (
          <li className="row" key={`${item.symbol}-${item.sessionDate}-${item.rule}`}>
            <div className="row-main">
              <strong>{item.name} +{(item.gainBps / 100).toFixed(2)}% · {RULES[item.rule] ?? item.rule}</strong>
              <span className="subtle">평균 매입가 {formatKrw(item.averagePrice)} → {formatKrw(item.price)}</span>
            </div>
            <div className="row-end"><span className="subtle">{formatSeoulTime(item.detectedAt)}</span></div>
          </li>))}
        </ul>)}
      <p className="footnote">모멘텀 보유 종목이 +5%, +10%, +30%에 처음 닿은 순간을 기록해요. 실제 매도 주문은 내지 않아요.</p>
    </Card>
  );
}
