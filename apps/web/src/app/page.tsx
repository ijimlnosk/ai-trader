import { redirect } from 'next/navigation';
import { ConsoleView, NoAccountView } from '@/views/console/ConsoleView';
import { currentSession } from '@/shared/auth/session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await currentSession();
  if (!session) redirect('/login');
  return session.user.hasTradingAccount ? <ConsoleView email={session.user.email} /> : <NoAccountView email={session.user.email} />;
}
