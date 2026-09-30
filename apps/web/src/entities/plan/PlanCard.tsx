'use client';
import { formatDecimal, formatKrw, formatRelative, formatSessionDate } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { reasonLabel } from '@/shared/lib/strategyLabels';
import { usePlan } from './queries';

const REJECTIONS: Record<string, string> = {
  INSUFFICIENT_CASH: '현금 부족', MAX_POSITION_EXPOSURE_EXCEEDED: '종목 비중 초과', MAX_PORTFOLIO_POSITIONS_EXCEEDED: '보유 종목 수 초과',
  DAILY_LOSS_LIMIT_EXCEEDED: '일일 손실 한도', CONSECUTIVE_LOSS_LIMIT_EXCEEDED: '연속 손실 한도', KILL_SWITCH_ENABLED: '매수 중단',
  CONFIDENCE_TOO_LOW: '신뢰도 부족',
};

/** Universe scan result for today. Order-free while being validated; execution re-checks risk. */
export function PlanCard() {
  const query = usePlan();
  const plan = query.data?.plan;
  return (
    <Card title="오늘의 매매 계획" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {!plan ? <Empty icon="🗺️">아직 계획이 없어요 (거래일 09:05에 전 종목을 훑어요)</Empty> : <>
        <p className="subtle">{formatSessionDate(plan.sessionDate)} · {plan.scanned}/{plan.universeSize}종목 분석 · {formatRelative(plan.createdAt)}</p>
        {plan.items.length === 0 ? <Empty icon="😴">오늘은 사거나 팔 신호가 없어요</Empty> : (
          <ul className="rows">{plan.items.map((item) => (
            <li className="row" key={item.symbol}>
              <span className={`side side-${item.side.toLowerCase()}`}>{item.side === 'BUY' ? '매수' : '매도'}</span>
              <div className="row-main">
                <strong>{item.rank}. {item.name} · {formatDecimal(item.quantity)}주</strong>
                <span className="subtle">{reasonLabel(item.reason)} · 예상 {formatKrw(item.estimatedPrice)}</span>
              </div>
              <div className="row-end">
                {item.approved ? <Chip tone="good">리스크 통과</Chip> : <Chip tone="neutral">제외</Chip>}
                {!item.approved && <span className="subtle">{item.rejections.map((code) => REJECTIONS[code] ?? code).join(', ')}</span>}
              </div>
            </li>))}
          </ul>)}
        <p className="footnote">검증 기간: 이 계획으로는 주문하지 않아요. 실제 자동매매는 아직 삼성전자만 대상이에요.</p>
      </>}
    </Card>
  );
}
