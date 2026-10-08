'use client';
import { useState } from 'react';
import type { ConsoleSettingsResponse, OwnerSettingsDto } from '@ai-trader/contracts';
import { Switch } from '@/shared/ui/Switch';

type Strategies = OwnerSettingsDto['strategies'];
const STRATEGIES: [keyof Strategies, string, string][] = [
  ['momentumExecution', '모멘텀 모의 주문', '모의계좌(1,000만원)에 실제 모의 주문을 내요'],
  ['shadowDayTrading', '가상 단타', '50만원 가상 장부, 주문 없음'],
  ['shadowEtfRotation', '가상 ETF 로테이션', '50만원 가상 장부, 주 1회, 주문 없음'],
  ['takeProfitWatch', '익절 감시', '+5/+10/+30% 도달 기록만'],
];

export function StrategySwitches({ draft, environment, onChange }: { draft: Strategies; environment: Strategies; onChange: (next: Strategies) => void }) {
  return (
    <ul className="rows">{STRATEGIES.map(([key, label, detail]) => (
      <li className="row" key={key}>
        <div className="row-main"><strong>{label}</strong>
          <span className="subtle">{environment[key] ? detail : '서버 설정에서 꺼져 있어 켜도 동작하지 않아요'}</span></div>
        <Switch checked={draft[key]} label={label} onToggle={() => onChange({ ...draft, [key]: !draft[key] })} />
      </li>))}
    </ul>
  );
}

export function PresetPicker({ name, value, options, onChange }: { name: string; value: string;
  options: ConsoleSettingsResponse['presets']['day'] | ConsoleSettingsResponse['presets']['etf']; onChange: (id: string) => void }) {
  return (
    <div className="preset-list" role="radiogroup" aria-label={name}>{options.map((option) => {
      const backtest = 'backtest' in option ? option.backtest : null;
      return (
        <label key={option.id} className={`preset ${value === option.id ? 'preset-selected' : ''}`}>
          <input type="radio" name={name} value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
          <strong>{option.label}</strong>
          <span className="subtle">{backtest ? `백테스트 검증 구간 ${backtest.outReturn}% / 낙폭 ${backtest.outDrawdown}% (고른 구간 ${backtest.inReturn}% / ${backtest.inDrawdown}%)`
            : '백테스트 없음 · 가상 기록으로 평가'}</span>
        </label>);
    })}</div>
  );
}

type Risk = OwnerSettingsDto['risk'];
const RISK: [keyof Risk, string, 'rate' | 'count', 'max' | 'min'][] = [
  ['maxPositionExposureRate', '종목당 최대 비중', 'rate', 'max'], ['maxOpenPositions', '최대 보유 종목 수', 'count', 'max'],
  ['maxDailyLossRate', '하루 손실 한도', 'rate', 'max'], ['maxConsecutiveLosses', '연속 손실 정지', 'count', 'max'],
  ['minConfidence', '최소 신뢰도', 'rate', 'min'],
];
const percent = (rate: string) => String(Math.round(Number(rate) * 10000) / 100);
const toRate = (value: string) => (Number(value) / 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0');

/** Inputs in % or counts, kept as typed; the server rejects anything looser than the default. */
export function RiskLimits({ draft, defaults, invalid, onChange }: { draft: Risk; defaults: Risk; invalid: string[]; onChange: (next: Risk) => void }) {
  const [text, setText] = useState<Record<string, string>>(() => Object.fromEntries(RISK.map(([key, , kind]) => [key, kind === 'rate' ? percent(String(draft[key])) : String(draft[key])])));
  return (
    <div className="risk-grid">{RISK.map(([key, label, kind, bound]) => (
      <label key={key} className={`field ${invalid.includes(`risk.${key}`) ? 'field-invalid' : ''}`}>
        <span>{label} <span className="subtle">({bound === 'max' ? '최대' : '최소'} {kind === 'rate' ? `${percent(String(defaults[key]))}%` : defaults[key]})</span></span>
        <input inputMode="decimal" value={text[key] ?? ''} onChange={(event) => {
          const value = event.target.value; setText({ ...text, [key]: value });
          onChange({ ...draft, [key]: kind === 'rate' ? toRate(value) : Number(value) });
        }} />
      </label>))}
    </div>
  );
}
