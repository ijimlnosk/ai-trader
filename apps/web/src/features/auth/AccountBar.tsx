'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
export function AccountBar({ email }: { email: string }) {
  const client = useQueryClient(); const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  useEffect(() => {
    const revalidate = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('pageshow', revalidate);
    return () => window.removeEventListener('pageshow', revalidate);
  }, []);
  async function logout() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store' });
      if (!response.ok) throw new Error();
      await client.cancelQueries(); client.clear(); window.location.replace('/login');
    } catch { setError('로그아웃하지 못했습니다. 다시 시도해 주세요.'); setPending(false); }
  }
  return <div className="account-bar"><span>{email}</span><button onClick={logout} disabled={pending}>로그아웃</button>
    {error && <span role="alert">{error}</span>}</div>;
}
