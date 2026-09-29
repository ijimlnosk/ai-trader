import type { ConsoleLoopRun } from '@ai-trader/contracts';
import { formatDecimal, formatFill, formatKrw, formatShortDate } from '@/shared/lib/format';
import { Chip } from '@/shared/ui/Chip';
import { RUN_STATUS, reasonLabel } from './labels';

export function decisionText(run: ConsoleLoopRun): string {
  if (!run.signal) return run.reason ?? '평가 결과 없음';
  if (!run.signal.side) return reasonLabel(run.signal.reason);
  const intent = `${run.signal.side === 'BUY' ? '매수' : '매도'} ${formatDecimal(run.signal.quantity)}주`;
  if (!run.decision) return intent;
  return run.decision.approved ? `${intent} · 리스크 승인` : `${intent} · 리스크 거부 (${run.decision.reasons.join(', ')})`;
}

export function LoopRunRow({ run }: { run: ConsoleLoopRun }) {
  const status = RUN_STATUS[run.status];
  return (
    <li className="row">
      <div className="row-date"><strong>{formatShortDate(run.sessionDate)}</strong><span className="subtle">{run.sessionDate.slice(0, 4)}</span></div>
      <div className="row-main">
        <strong>{run.signal ? reasonLabel(run.signal.reason) : '평가 없음'}</strong>
        <span className="subtle">{decisionText(run)}</span>
        {run.order && <span className="subtle">체결 {formatFill(run.order.filledQuantity, run.order.quantity)} · {formatKrw(run.order.filledAmount)}</span>}
      </div>
      <div className="row-end"><Chip tone={status.tone}>{status.label}</Chip></div>
    </li>
  );
}
