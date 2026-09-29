import type { ReactNode } from 'react';

export type ChipTone = 'neutral' | 'good' | 'warn' | 'danger' | 'info';

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}
