'use client';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const [error, setError] = useState(''); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: values.get('email'), password: values.get('password') }), cache: 'no-store' });
      if (response.ok) { window.location.replace('/'); return; }
      setError(response.status === 401 ? '이메일 또는 비밀번호를 확인해 주세요.'
        : response.status === 429 ? '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.' : '로그인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } catch { setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="login-form">
    <label className="field"><span>이메일</span>
      <input name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" maxLength={254} required /></label>
    <label className="field"><span>비밀번호</span>
      <input name="password" type="password" autoComplete="current-password" maxLength={128} required /></label>
    {error && <p role="alert" className="notice notice-warn">{error}</p>}
    <button type="submit" className="primary" disabled={pending}>{pending ? '로그인 중…' : '로그인'}</button>
    <p className="footnote">관리자가 등록한 계정으로 로그인하세요. 계정 발급·비밀번호 재설정은 관리자에게 요청해 주세요.</p>
  </form>;
}
