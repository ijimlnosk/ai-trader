import type { ReactNode } from 'react';
import { formatRelative } from '@/shared/lib/format';

/** A titled card that keeps the last good data visible and flags it when a refresh failed. */
export function Card(props: { title?: string; action?: ReactNode; updatedAt?: number; isLoading?: boolean;
  error?: Error | null; className?: string; children?: ReactNode }) {
  const { title, action, updatedAt = 0, isLoading = false, error = null, className = '', children } = props;
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {action ?? (updatedAt ? <span className="subtle">{formatRelative(updatedAt)}</span> : null)}
        </header>
      )}
      {error && <p className="notice notice-warn" role="status">{updatedAt ? '최신 정보를 가져오지 못해 이전 데이터를 보여주고 있어요.' : '정보를 가져오지 못했어요.'}</p>}
      {isLoading && !updatedAt ? <Skeleton /> : children}
    </section>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-label="불러오는 중">{Array.from({ length: lines }, (_, i) => <span key={i} />)}</div>;
}

export function Empty({ icon = '—', children }: { icon?: string; children: ReactNode }) {
  return <div className="empty"><span aria-hidden>{icon}</span><p>{children}</p></div>;
}
