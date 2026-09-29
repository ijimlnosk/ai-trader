import { NextResponse, type NextRequest } from 'next/server';
import { proxyConsoleRequest } from '@/shared/api/consoleProxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const result = await proxyConsoleRequest(path, request.nextUrl.searchParams,
    { apiUrl: process.env.CONSOLE_API_URL, readToken: process.env.CONSOLE_READ_TOKEN });
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
}
