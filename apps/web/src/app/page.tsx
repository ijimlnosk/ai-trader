import { redirect } from 'next/navigation';
import { ConsoleView } from '@/views/console/ConsoleView';
import { currentSession } from '@/shared/auth/session';
import { AccountBar } from '@/features/auth/AccountBar';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const session = await currentSession();
  if (!session) redirect('/login');
  return <><AccountBar email={session.user.email} />{session.user.hasTradingAccount ? <ConsoleView />
    : <main className="grid"><section className="panel"><h1>연결된 거래계좌가 없습니다</h1>
      <p>이 로그인 계정에 연결된 거래계좌가 없습니다. 관리자에게 계좌 연결을 요청해 주세요.</p></section></main>}</>;
}
