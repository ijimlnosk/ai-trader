import { NextResponse, type NextRequest } from 'next/server';
import { allowedOrigin } from '@/shared/auth/policy';
import { readLoginBody } from '@/shared/auth/readLoginBody';
import { sessionToken } from '@/shared/auth/session';
import { forwardAutoTradingControl } from '@/shared/controls/forwardControl';

export const dynamic = 'force-dynamic';

/** Same-origin, size-limited POST; the browser never handles the session token itself. */
export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!allowedOrigin(request.headers.get('origin'), process.env.CONSOLE_PUBLIC_ORIGIN)) {
    return NextResponse.json({ error: { code: 'forbidden_origin' } }, { status: 403, headers });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new NextResponse(null, { status: 415, headers });
  const text = await readLoginBody(request);
  if (text === null) return new NextResponse(null, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: { code: 'invalid_request' } }, { status: 400, headers }); }
  const result = await forwardAutoTradingControl(body, { apiUrl: process.env.CONSOLE_API_URL, sessionToken: await sessionToken() });
  return NextResponse.json(result.body, { status: result.status, headers });
}
