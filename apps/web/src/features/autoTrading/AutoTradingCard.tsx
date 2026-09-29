'use client';
import { useState, type FormEvent } from 'react';
import { ConsoleRequestError } from '@/shared/api/fetchConsole';
import { formatRelative, formatSeoulTime } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Sheet } from '@/shared/ui/Sheet';
import { Switch } from '@/shared/ui/Switch';
import { useControls } from '@/entities/controls/queries';
import { CONTROL_ERRORS, useSetAutoTrading } from './queries';

/** Owner pause/resume. Pausing is one confirmation; resuming asks for the password again. */
export function AutoTradingCard() {
  const query = useControls();
  const mutation = useSetAutoTrading();
  const [sheet, setSheet] = useState<'pause' | 'resume' | null>(null);
  const [error, setError] = useState('');
  const control = query.data?.autoTrading;
  const close = () => { setSheet(null); setError(''); mutation.reset(); };
  const fail = (cause: unknown) => setError(cause instanceof ConsoleRequestError ? CONTROL_ERRORS[cause.code] ?? '변경하지 못했어요. 잠시 후 다시 시도해 주세요.' : '서버에 연결할 수 없어요.');
  async function resume(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    try { await mutation.mutateAsync({ enabled: true, password }); close(); } catch (cause) { fail(cause); }
  }
  async function pause() {
    setError('');
    try { await mutation.mutateAsync({ enabled: false }); close(); } catch (cause) { fail(cause); }
  }
  const state = !control ? null : control.effective ? 'on' : control.enabled && !control.environmentAllows ? 'blocked' : 'off';
  return (
    <Card title="자동매매" updatedAt={query.dataUpdatedAt} isLoading={query.isLoading} error={query.error}>
      {control && <>
        <div className="control-row">
          <div>
            <strong className={`control-state control-${state}`}>{state === 'on' ? '켜짐' : state === 'blocked' ? '서버에서 막힘' : '꺼짐'}</strong>
            <p className="subtle">{state === 'on' ? '장중 09:05–15:00에 전략이 모의 주문을 낼 수 있어요.' : '새 주문을 내지 않아요. 이미 낸 주문의 체결 확인은 계속해요.'}</p>
          </div>
          <Switch checked={control.enabled} label="자동매매" disabled={mutation.isPending || (!control.enabled && !control.environmentAllows)}
            onToggle={() => setSheet(control.enabled ? 'pause' : 'resume')} />
        </div>
        {!control.environmentAllows && <p className="notice notice-warn">서버 설정에서 자동매매가 꺼져 있어 웹에서 켤 수 없어요.</p>}
        {control.updatedAt && <p className="footnote">마지막 변경 {formatRelative(control.updatedAt)} · {control.updatedByEmail ?? '알 수 없음'}</p>}
        {query.data!.events.length > 0 && (
          <details className="history"><summary>변경 기록</summary>
            <ul>{query.data!.events.map((event) => (
              <li key={event.at}><span>{event.enabled ? '켬' : '끔'}</span><span className="subtle">{formatSeoulTime(event.at)} · {event.byEmail ?? '—'}</span></li>))}
            </ul>
          </details>)}
      </>}
      <Sheet open={sheet === 'pause'} title="자동매매를 끌까요?" onClose={close}>
        <p className="subtle">새 모의 주문을 더 이상 내지 않아요. 이미 낸 주문은 취소되지 않고 체결 확인만 계속해요.</p>
        {error && <p role="alert" className="notice notice-warn">{error}</p>}
        <div className="sheet-actions">
          <button type="button" className="secondary" onClick={close}>취소</button>
          <button type="button" className="primary danger" onClick={pause} disabled={mutation.isPending}>{mutation.isPending ? '끄는 중…' : '끄기'}</button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'resume'} title="자동매매를 켤까요?" onClose={close}>
        <p className="subtle">장중(09:05–15:00)에 전략 신호가 나오면 모의 주문이 자동으로 나가요. 본인 확인을 위해 비밀번호를 입력해 주세요.</p>
        <form onSubmit={resume} className="login-form">
          <label className="field"><span>비밀번호</span>
            <input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
          {error && <p role="alert" className="notice notice-warn">{error}</p>}
          <div className="sheet-actions">
            <button type="button" className="secondary" onClick={close}>취소</button>
            <button type="submit" className="primary" disabled={mutation.isPending}>{mutation.isPending ? '켜는 중…' : '켜기'}</button>
          </div>
        </form>
      </Sheet>
    </Card>
  );
}
