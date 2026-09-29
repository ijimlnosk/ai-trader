import { NextRequest, NextResponse } from 'next/server';
import { allowedOrigin, sessionCookie } from '@/shared/auth/policy';
import { sessionToken } from '@/shared/auth/session';
import { authRequest } from '@/shared/auth/authProxy';

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!allowedOrigin(request.headers.get('origin'), process.env.CONSOLE_PUBLIC_ORIGIN)) return new NextResponse(null, { status: 403, headers });
  const upstream = await authRequest('logout', {}, await sessionToken());
  if (!upstream.ok) return NextResponse.json({ error: { code: 'logout_failed' } }, { status: 503, headers });
  const response = NextResponse.json({ ok: true }, { headers: { ...headers, 'Clear-Site-Data': '"cache"' } });
  const production = process.env.NODE_ENV === 'production';
  response.cookies.set(sessionCookie(production), '', { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
