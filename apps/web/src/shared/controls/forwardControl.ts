/** Server-only: forwards the owner's pause/resume request with the session held in the cookie. */
export async function forwardAutoTradingControl(body: unknown, env: { apiUrl?: string | undefined; sessionToken?: string | undefined },
  fetcher: (input: string, init: RequestInit) => Promise<Response> = fetch): Promise<{ status: number; body: unknown }> {
  if (!env.sessionToken) return { status: 401, body: { error: { code: 'unauthorized' } } };
  if (!env.apiUrl) return { status: 503, body: { error: { code: 'console_not_configured' } } };
  if (!body || typeof body !== 'object' || typeof (body as { enabled?: unknown }).enabled !== 'boolean') {
    return { status: 400, body: { error: { code: 'invalid_request' } } };
  }
  const { enabled, password } = body as { enabled: boolean; password?: unknown };
  const payload = enabled ? { enabled, password } : { enabled };
  try {
    const response = await fetcher(new URL('/api/v1/me/controls/auto-trading', env.apiUrl).toString(), {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.sessionToken}` }, body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  } catch {
    return { status: 502, body: { error: { code: 'upstream_unavailable' } } };
  }
}
