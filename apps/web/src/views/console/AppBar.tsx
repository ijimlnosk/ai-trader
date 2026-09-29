'use client';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { ModePill } from '@/entities/status/ModePill';
import { AccountMenu } from '@/features/auth/AccountMenu';

export function AppBar({ email, showMode = true }: { email: string; showMode?: boolean }) {
  const client = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['console'] }) > 0;
  return (
    <header className="appbar">
      <div className="appbar-title"><strong>AI Trader</strong>{showMode && <ModePill />}</div>
      <div className="appbar-actions">
        {showMode && (
          <button className="icon-button" aria-label="새로고침" onClick={() => client.invalidateQueries({ queryKey: ['console'] })} disabled={fetching}>
            <span aria-hidden className={fetching ? 'spin' : ''}>↻</span>
          </button>
        )}
        <AccountMenu email={email} />
      </div>
    </header>
  );
}
