import { redirect } from 'next/navigation';
import { currentSession } from '@/shared/auth/session';
import { LoginForm } from '@/features/auth/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await currentSession()) redirect('/');
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand"><span aria-hidden className="brand-mark">AI</span><h1>AI Trader</h1></div>
        <p className="subtle">내 모의투자 계좌와 자동매매 현황을 확인하세요.</p>
        <LoginForm />
      </section>
    </main>
  );
}
