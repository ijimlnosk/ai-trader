'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

/** Account email and logout in a compact menu; logout clears cached data before leaving. */
export function AccountMenu({ email }: { email: string }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A page restored from the back/forward cache must re-check the session.
    const revalidate = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener('pageshow', revalidate);
    document.addEventListener('click', close);
    return () => { window.removeEventListener('pageshow', revalidate); document.removeEventListener('click', close); };
  }, []);
  async function logout() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
      if (!response.ok) throw new Error();
      await client.cancelQueries(); client.clear(); window.location.replace('/login');
    } catch { setError('로그아웃하지 못했어요. 다시 시도해 주세요.'); setPending(false); }
  }
  return (
    <div className="account" ref={ref}>
      <button className="icon-button" aria-label="계정" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span aria-hidden>{email.slice(0, 1).toUpperCase()}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="subtle">{email}</p>
          <button role="menuitem" className="menu-item" onClick={logout} disabled={pending}>{pending ? '로그아웃 중…' : '로그아웃'}</button>
          {error && <p role="alert" className="notice notice-warn">{error}</p>}
        </div>
      )}
    </div>
  );
}
