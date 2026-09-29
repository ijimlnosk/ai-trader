'use client';
import { useQuery } from '@tanstack/react-query';
import type { ConsoleList, ConsoleSnapshot } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';
import { formatDecimal, formatKrw, formatSeoulTime, formatSessionDate } from '@/shared/lib/format';
import { Empty, Panel } from '@/shared/ui/Panel';

export function SnapshotsPanel() {
  const query = useQuery({ queryKey: ['console', 'snapshots'], queryFn: () => fetchConsole<ConsoleList<ConsoleSnapshot>>('snapshots', 10), refetchInterval: 300000 });
  const items = query.data?.items ?? [];
  return (
    <Panel title="일봉 스냅샷 (005930, 원주가)" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty>저장된 스냅샷 없음</Empty> : (
        <table><thead><tr><th>기준 세션</th><th>수집 시각</th><th>봉</th><th>마지막 종가</th><th>거래량(주)</th><th>정정</th><th>캘린더</th><th>digest</th></tr></thead>
          <tbody>{items.map((s) => (
            <tr key={s.id}><td>{formatSessionDate(s.through)}</td><td>{formatSeoulTime(s.collectedAt)}</td><td>{s.bars}</td>
              <td>{formatKrw(s.lastBar?.close)}</td><td>{formatDecimal(s.lastBar?.volume)}</td>
              <td className={s.revisedDates.length ? 'warn-text' : ''}>{s.revisedDates.length ? s.revisedDates.map(formatSessionDate).join(', ') : '없음'}</td>
              <td>{s.calendarVersion}</td><td className="mono">{s.datasetSha256.slice(0, 12)}</td></tr>))}
          </tbody></table>)}
    </Panel>
  );
}
