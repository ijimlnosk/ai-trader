import { redirect } from 'next/navigation';
import { currentSession } from '@/shared/auth/session';
import { LoginForm } from '@/features/auth/LoginForm';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  if (await currentSession()) redirect('/');
  return <main className="login-shell"><section className="panel login-panel"><h1>AI Trader</h1>
    <p>내 계좌의 모의투자 현황을 확인하세요.</p><LoginForm /></section></main>;
}
