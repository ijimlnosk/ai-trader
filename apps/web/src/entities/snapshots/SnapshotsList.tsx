'use client';
import { formatDecimal, formatKrw, formatSeoulTime, formatShortDate } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { useSnapshots } from './queries';

export function SnapshotsList() {
  const query = useSnapshots();
  const items = query.data?.items ?? [];
  return (
    <Card title="시장 데이터 (삼성전자 일봉)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty icon="📈">저장된 데이터가 없어요</Empty> : (
        <ul className="rows">{items.map((s) => (
          <li className="row" key={s.id}>
            <div className="row-date"><strong>{formatShortDate(s.through)}</strong><span className="subtle">기준</span></div>
            <div className="row-main">
              <strong className="num">종가 {formatKrw(s.lastBar?.close)}</strong>
              <span className="subtle">거래량 {formatDecimal(s.lastBar?.volume)}주 · {s.bars}일치</span>
              <span className="subtle">수집 {formatSeoulTime(s.collectedAt)}</span>
              {s.confirmedAt !== s.collectedAt && <span className="subtle">재확인 {formatSeoulTime(s.confirmedAt)}</span>}
            </div>
            <div className="row-end">
              {s.revisedDates.length ? <Chip tone="warn">정정 {s.revisedDates.length}건</Chip> : <Chip tone="neutral">정정 없음</Chip>}
              <span className="subtle mono">{s.datasetSha256.slice(0, 8)}</span>
            </div>
          </li>))}
        </ul>)}
      <p className="footnote">원주가(수정주가 아님) 기준 · KIS 제공 데이터 · 자동매매는 당일 아침 08시 이후 재확인된 데이터로만 판단해요.</p>
    </Card>
  );
}
