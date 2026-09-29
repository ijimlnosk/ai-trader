'use client';
import { formatFill, formatKrw, formatRelative, formatSessionDate } from '@/shared/lib/format';
import { Card, Empty } from '@/shared/ui/Card';
import { Chip } from '@/shared/ui/Chip';
import { RUN_STATUS, reasonLabel } from './labels';
import { decisionText } from './LoopRunRow';
import { useLoopRuns } from './queries';

/** The most recent strategy decision, answering "what did the system do last?". */
export function LatestRunCard() {
  const query = useLoopRuns();
  const run = query.data?.items[0];
  return (
    <Card title="최근 자동매매" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {!run ? <Empty icon="🤖">아직 실행 기록이 없어요</Empty> : (
        <div className="latest">
          <div className="latest-head">
            <span className="subtle">{formatSessionDate(run.sessionDate)} 세션 · {formatRelative(run.createdAt)}</span>
            <Chip tone={RUN_STATUS[run.status].tone}>{RUN_STATUS[run.status].label}</Chip>
          </div>
          <p className="latest-title">{run.signal ? reasonLabel(run.signal.reason) : '평가 결과 없음'}</p>
          <p className="subtle">{decisionText(run)}</p>
          {run.order && (
            <div className={`latest-order side-bg-${run.order.side.toLowerCase()}`}>
              <span>{run.order.side === 'BUY' ? '매수' : '매도'} {formatFill(run.order.filledQuantity, run.order.quantity)} 체결</span>
              <strong className="num">{formatKrw(run.order.filledAmount)}</strong>
            </div>
          )}
          {run.status === 'HALTED' && <p className="notice notice-danger">자동매매가 중단됐어요. 서버에서 원인을 확인해야 해요{run.reason ? ` (${run.reason})` : ''}.</p>}
        </div>
      )}
    </Card>
  );
}
