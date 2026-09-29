import type { ReactNode } from 'react';
import { formatSeoulTime } from '@/shared/lib/format';

/** Keeps the last good data visible and marks it stale when the latest refresh failed. */
export function Panel(props: { title: string; updatedAt: number; isLoading: boolean; error: Error | null; children?: ReactNode }) {
  const { title, updatedAt, isLoading, error, children } = props;
  return (
    <section className="panel">
      <header className="panel-header">
        <h2>{title}</h2>
        <span className="muted">{updatedAt ? `갱신 ${formatSeoulTime(new Date(updatedAt).toISOString())}` : ''}</span>
      </header>
      {error && <p className="warning">{updatedAt ? '최신 조회 실패 — 아래는 이전 데이터입니다' : '조회 실패'}: {error.message}</p>}
      {isLoading && !updatedAt ? <p className="muted">불러오는 중…</p> : children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}
