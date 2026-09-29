'use client';
import { useId, type ReactNode } from 'react';

/** Segmented control for small screens; wide screens show every panel side by side via CSS. */
export function Tabs<T extends string>(props: { value: T; onChange: (value: T) => void;
  items: readonly { value: T; label: string; badge?: number | undefined }[]; children: (value: T) => ReactNode }) {
  const id = useId();
  return (
    <div className="tabs">
      <div role="tablist" aria-label="상세 정보" className="tablist">
        {props.items.map((item) => (
          <button key={item.value} role="tab" id={`${id}-${item.value}`} aria-selected={props.value === item.value}
            aria-controls={`${id}-panel`} className="tab" onClick={() => props.onChange(item.value)}>
            {item.label}{item.badge ? <span className="tab-badge">{item.badge}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${props.value}`}>{props.children(props.value)}</div>
    </div>
  );
}
