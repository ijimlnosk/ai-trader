import { cookies } from 'next/headers';
import type { ConsoleSessionResponse } from '@ai-trader/contracts';
import { sessionCookie } from './policy';
import { parseSession } from './parseSession';

export async function sessionToken(): Promise<string | undefined> {
  const token = (await cookies()).get(sessionCookie(process.env.NODE_ENV === 'production'))?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}
export async function currentSession(): Promise<ConsoleSessionResponse | null> {
  const token = await sessionToken();
  if (!token) return null;
  if (!process.env.CONSOLE_API_URL) throw new Error('로그인 서버에 연결할 수 없습니다.');
  const response = await fetch(new URL('/api/v1/auth/me', process.env.CONSOLE_API_URL), {
    cache: 'no-store', redirect: 'error', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return parseSession(await response.json());
}
