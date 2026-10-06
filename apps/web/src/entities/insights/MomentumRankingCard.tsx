'use client';
import { useState } from 'react';
import type { ConsoleInsightsResponse } from '@ai-trader/contracts';
import { formatDecimal, formatKrw, formatSessionDate } from '@/shared/lib/format';
import { reasonLabel } from '@/shared/lib/strategyLabels';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { useInsights } from './queries';

type Row = NonNullable<ConsoleInsightsResponse['momentum']>['rows'][number];

function RankingRow({ row }: { row: Row }) {
  return (
    <li className="row">
      <div className="row-main">
        <strong>{row.rank === null ? '' : `${row.rank + 1}위 · `}{row.name}</strong>
        <span className="subtle">{reasonLabel(row.reason)}</span>
        {row.momentumPct !== null && (
          <span className="subtle">6개월 {row.momentumPct > 0 ? '+' : ''}{row.momentumPct}% · 종가 {formatKrw(row.close)} · 120일 평균 {formatKrw(row.trendMa)}</span>)}
      </div>
      <div className="row-end">
        {row.proposedQuantity && <Chip tone="info">매수 {formatDecimal(row.proposedQuantity)}주</Chip>}
        {row.heldQuantity !== '0' && <Chip tone="neutral">보유 {formatDecimal(row.heldQuantity)}주</Chip>}
        {row.close !== null && (row.affordableSmall ? <Chip tone="good">50만원 가능</Chip> : <span className="subtle">50만원으론 1주 불가</span>)}
      </div>
    </li>
  );
}

/** Why momentum bought what it bought: the full ranking of the latest plan, not only the orders. */
export function MomentumRankingCard() {
  const query = useInsights();
  const momentum = query.data?.momentum;
  const [showAll, setShowAll] = useState(false);
  const ranked = momentum?.rows.filter((row) => row.rank !== null) ?? [];
  const rows = showAll ? momentum?.rows ?? [] : ranked.slice(0, 10);
  return (
    <Card title="모멘텀 순위와 매수 근거" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {!momentum ? <Empty icon="📊">아직 모멘텀 계획이 없어요</Empty> : <>
        <p className="subtle">{formatSessionDate(momentum.sessionDate)} 기준 · 상승 추세(종가 &gt; 120일 평균)인 종목을 6개월 상승률로 줄 세워 상위 5개를 사요.</p>
        <ul className="rows">{rows.map((row) => <RankingRow key={row.symbol} row={row} />)}</ul>
        <button type="button" className="link-button" onClick={() => setShowAll(!showAll)}>
          {showAll ? '상위 10개만 보기' : `전체 ${momentum.rows.length}종목 보기 (조건 충족 ${ranked.length}개)`}
        </button>
        <p className="footnote">50만원 기준: 종목당 {formatKrw(momentum.smallAccount.budgetKrw)}(9%)로 1주를 살 수 있는지 표시해요. 표시일 뿐 규칙은 바꾸지 않아요.</p>
      </>}
    </Card>
  );
}
