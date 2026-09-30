'use client';
import { useState } from 'react';
import type { ConsolePlan } from '@ai-trader/contracts';
import { formatDecimal, formatKrw, formatRelative, formatSessionDate } from '@/shared/lib/format';
import { reasonLabel } from '@/shared/lib/strategyLabels';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { usePlan } from './queries';

const REJECTIONS: Record<string, string> = {
  INSUFFICIENT_CASH: '현금 부족', MAX_POSITION_EXPOSURE_EXCEEDED: '종목 비중 초과', MAX_PORTFOLIO_POSITIONS_EXCEEDED: '보유 종목 수 초과',
  DAILY_LOSS_LIMIT_EXCEEDED: '일일 손실 한도', CONSECUTIVE_LOSS_LIMIT_EXCEEDED: '연속 손실 한도', KILL_SWITCH_ENABLED: '매수 중단',
  CONFIDENCE_TOO_LOW: '신뢰도 부족',
};

const NEWS: Record<string, { label: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }> = {
  clear: { label: '뉴스 이상 없음', tone: 'good' }, caution: { label: '뉴스 주의', tone: 'warn' }, veto: { label: '뉴스 악재 · 매수 보류 권고', tone: 'danger' },
};
function NewsVerdict({ news }: { news: ConsolePlan['items'][number]['news'] }) {
  if (!news) return null;
  if (news.status !== 'assessed' || !news.verdict) {
    const label = news.status === 'no_news' ? '최근 뉴스 없음' : news.status === 'budget_exhausted' ? 'AI 예산 소진' : 'AI 판단 불가';
    return <span className="subtle">{label}</span>;
  }
  const meta = NEWS[news.verdict]!;
  return <div className="news-verdict"><Chip tone={meta.tone}>{meta.label}</Chip>{news.summary && <span className="subtle">{news.summary}</span>}</div>;
}

function PlanItems({ plan }: { plan: ConsolePlan }) {
  if (plan.items.length === 0) return <Empty icon="😴">오늘은 사거나 팔 신호가 없어요</Empty>;
  return (
    <ul className="rows">{plan.items.map((item) => (
      <li className="row" key={item.symbol}>
        <span className={`side side-${item.side.toLowerCase()}`}>{item.side === 'BUY' ? '매수' : '매도'}</span>
        <div className="row-main">
          <strong>{item.rank}. {item.name} · {formatDecimal(item.quantity)}주</strong>
          <span className="subtle">{reasonLabel(item.reason)} · 예상 {formatKrw(item.estimatedPrice)}</span>
          <NewsVerdict news={item.news} />
        </div>
        <div className="row-end">
          {item.approved ? <Chip tone="good">리스크 통과</Chip> : <Chip tone="neutral">제외</Chip>}
          {!item.approved && <span className="subtle">{item.rejections.map((code) => REJECTIONS[code] ?? code).join(', ')}</span>}
        </div>
      </li>))}
    </ul>
  );
}

/** Universe scan per strategy for today. Order-free while being validated; execution re-checks risk. */
export function PlanCard() {
  const query = usePlan();
  const plans = query.data?.plans ?? [];
  const [selected, setSelected] = useState(0);
  const plan = plans[Math.min(selected, plans.length - 1)];
  return (
    <Card title="오늘의 매매 계획" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {!plan ? <Empty icon="🗺️">아직 계획이 없어요 (거래일 09:05에 전 종목을 훑어요)</Empty> : <>
        {plans.length > 1 && (
          <div className="segmented" role="tablist" aria-label="전략">
            {plans.map((p, index) => (
              <button key={p.strategyId} role="tab" aria-selected={plan === p} className="segment" onClick={() => setSelected(index)}>{p.label}</button>))}
          </div>)}
        <p className="subtle">{formatSessionDate(plan.sessionDate)} · {plan.scanned}/{plan.universeSize}종목 분석 · {formatRelative(plan.createdAt)}</p>
        <PlanItems plan={plan} />
        <p className="footnote">모멘텀 계획의 리스크 통과 항목은 자동매매가 켜져 있으면 모의 주문으로 실행돼요. AI 뉴스 판정은 아직 기록만 하고 주문에는 반영하지 않아요.</p>
        {query.data?.aiUsage && <p className="footnote">AI 분석({query.data.aiUsage.model}) 비용 오늘 ${(query.data.aiUsage.dailyMicroUsd / 1e6).toFixed(3)} / ${(query.data.aiUsage.dailyCapMicroUsd / 1e6).toFixed(2)} · 이번 달 ${(query.data.aiUsage.monthlyMicroUsd / 1e6).toFixed(2)} / ${(query.data.aiUsage.monthlyCapMicroUsd / 1e6).toFixed(2)}</p>}
      </>}
    </Card>
  );
}
