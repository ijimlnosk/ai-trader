'use client';
import { useState, type FormEvent } from 'react';
import type { OwnerSettingsDto } from '@ai-trader/contracts';
import { formatSeoulTime, formatSessionDate } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Sheet } from '@/shared/ui/Sheet';
import { PresetPicker, RiskLimits, StrategySwitches } from './SettingsSections';
import { SETTINGS_ERRORS, SettingsRequestError, useSaveSettings, useSettings } from './queries';

/** Owner settings: presets and switches, risk limits only stricter, password on save, applied from the next session. */
export function SettingsPanel() {
  const query = useSettings();
  const data = query.data;
  if (!data) return <Card title="설정" isLoading={query.isLoading} error={query.error} />;
  return <SettingsForm key={data.pending?.createdAt ?? 'effective'} initial={data.pending?.settings ?? data.effective} />;
}

function SettingsForm({ initial }: { initial: OwnerSettingsDto }) {
  const query = useSettings(); const data = query.data!;
  const mutation = useSaveSettings();
  const [draft, setDraft] = useState(initial);
  const [sheet, setSheet] = useState(false); const [error, setError] = useState(''); const [invalid, setInvalid] = useState<string[]>([]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    try { await mutation.mutateAsync({ password, settings: draft }); setSheet(false); setInvalid([]); }
    catch (cause) {
      setInvalid(cause instanceof SettingsRequestError ? cause.fields : []);
      setError(cause instanceof SettingsRequestError ? SETTINGS_ERRORS[cause.code] ?? '저장하지 못했어요.' : '서버에 연결할 수 없어요.');
    }
  }
  return (
    <div className="column">
      {data.pending && <p className="notice">{formatSessionDate(data.pending.effectiveFrom)}부터 적용될 변경이 저장돼 있어요 · {formatSeoulTime(data.pending.createdAt)}</p>}
      <Card title="전략 켜기/끄기" updatedAt={query.dataUpdatedAt}>
        <StrategySwitches draft={draft.strategies} environment={data.environment} onChange={(strategies) => setDraft({ ...draft, strategies })} />
        <p className="footnote">꺼도 이미 가진 가상 보유 종목의 매도는 계속해요. 실거래 전환은 여기서 할 수 없어요.</p>
      </Card>
      <Card title="가상 단타 규칙">
        <PresetPicker name="dayPreset" value={draft.dayPreset} options={data.presets.day} onChange={(dayPreset) => setDraft({ ...draft, dayPreset })} />
      </Card>
      <Card title="가상 ETF 규칙">
        <PresetPicker name="etfPreset" value={draft.etfPreset} options={data.presets.etf} onChange={(etfPreset) => setDraft({ ...draft, etfPreset })} />
      </Card>
      <Card title="위험 한도 (더 엄격하게만)">
        <RiskLimits draft={draft.risk} defaults={data.defaults.risk} invalid={invalid} onChange={(risk) => setDraft({ ...draft, risk })} />
        <p className="footnote">모의 주문에 적용돼요. 기본값보다 느슨하게는 바꿀 수 없어요.</p>
      </Card>
      {error && !sheet && <p role="alert" className="notice notice-warn">{error}</p>}
      <button type="button" className="primary" onClick={() => { setError(''); setSheet(true); }}>저장 (다음 거래일부터 적용)</button>
      {data.history.length > 0 && (
        <details className="history"><summary>변경 기록</summary>
          <ul>{data.history.map((row) => (
            <li key={row.createdAt}><span>{formatSessionDate(row.effectiveFrom)}부터</span><span className="subtle">{formatSeoulTime(row.createdAt)} · {row.byEmail ?? '—'}</span></li>))}
          </ul>
        </details>)}
      <Sheet open={sheet} title="설정을 저장할까요?" onClose={() => setSheet(false)}>
        <p className="subtle">다음 거래일부터 적용돼요. 본인 확인을 위해 비밀번호를 입력해 주세요.</p>
        <form onSubmit={save} className="login-form">
          <label className="field"><span>비밀번호</span><input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
          {error && <p role="alert" className="notice notice-warn">{error}</p>}
          <div className="sheet-actions">
            <button type="button" className="secondary" onClick={() => setSheet(false)}>취소</button>
            <button type="submit" className="primary" disabled={mutation.isPending}>{mutation.isPending ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
