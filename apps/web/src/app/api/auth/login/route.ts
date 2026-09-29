import { NextRequest, NextResponse } from 'next/server';
import { allowedOrigin, sessionCookie } from '@/shared/auth/policy';
import { authRequest } from '@/shared/auth/authProxy';
import { readLoginBody } from '@/shared/auth/readLoginBody';

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!allowedOrigin(request.headers.get('origin'), process.env.CONSOLE_PUBLIC_ORIGIN)) {
    return NextResponse.json({ error: { code: 'forbidden_origin' } }, { status: 403, headers });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new NextResponse(null, { status: 415, headers });
  const text = await readLoginBody(request);
  if (text === null) return new NextResponse(null, { status: 413, headers });
  let input: unknown;
  try { input = JSON.parse(text); } catch { return new NextResponse(null, { status: 400, headers }); }
  const upstream = await authRequest('login', input);
  if (!upstream.ok) {
    const code = upstream.status === 401 ? 'unauthorized' : upstream.status === 429 ? 'login_rate_limited' : 'auth_unavailable';
    return NextResponse.json({ error: { code } }, { status: upstream.status, headers });
  }
  const data: unknown = await upstream.json().catch(() => null);
  if (!data || typeof data !== 'object' || !('token' in data) || typeof data.token !== 'string' || !/^[a-f0-9]{64}$/.test(data.token)
    || !('expiresAt' in data) || typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))) {
    return NextResponse.json({ error: { code: 'auth_unavailable' } }, { status: 502, headers });
  }
  const response = NextResponse.json({ ok: true }, { headers });
  const production = process.env.NODE_ENV === 'production';
  response.cookies.set(sessionCookie(production), data.token, { httpOnly: true, secure: production,
    sameSite: 'strict', path: '/', expires: new Date(data.expiresAt) });
  return response;
}
