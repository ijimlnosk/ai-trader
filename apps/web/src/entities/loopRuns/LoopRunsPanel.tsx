'use client';
import { useQuery } from '@tanstack/react-query';
import type { ConsoleList, ConsoleLoopRun } from '@ai-trader/contracts';
import { fetchConsole } from '@/shared/api/fetchConsole';
import { formatDecimal, formatSeoulTime, formatSessionDate } from '@/shared/lib/format';
import { Empty, Panel } from '@/shared/ui/Panel';
import { OrderSummary } from '@/shared/ui/OrderSummary';

export function LoopRunsPanel() {
  const query = useQuery({ queryKey: ['console', 'loop-runs'], queryFn: () => fetchConsole<ConsoleList<ConsoleLoopRun>>('loop-runs', 20), refetchInterval: 60000 });
  const items = query.data?.items ?? [];
  return (
    <Panel title="Paper loop 실행" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {items.length === 0 ? <Empty>실행 기록 없음</Empty> : (
        <table><thead><tr><th>세션</th><th>상태</th><th>신호</th><th>리스크</th><th>주문</th><th>생성</th></tr></thead>
          <tbody>{items.map((r) => (
            <tr key={r.id}>
              <td>{formatSessionDate(r.sessionDate)}<div className="muted mono">{r.runKey}</div></td>
              <td className={r.status === 'COMPLETE' ? '' : 'warn-text'}>{r.status}{r.reason ? ` (${r.reason})` : ''}</td>
              <td>{r.signal ? `${r.signal.reason}${r.signal.side ? ` ${r.signal.side} ${formatDecimal(r.signal.quantity)}주` : ''}` : '—'}</td>
              <td>{r.decision ? (r.decision.approved ? '승인' : `거부 ${r.decision.reasons.join(', ')}`) : '—'}</td>
              <td>{r.order ? <OrderSummary order={r.order} /> : '—'}</td>
              <td>{formatSeoulTime(r.createdAt)}</td></tr>))}
          </tbody></table>)}
    </Panel>
  );
}
