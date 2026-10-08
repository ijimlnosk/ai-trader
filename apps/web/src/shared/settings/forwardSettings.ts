/** Server-only: forwards the owner's settings change with the session held in the cookie. */
export async function forwardSettings(body: unknown, env: { apiUrl?: string | undefined; sessionToken?: string | undefined },
  fetcher: (input: string, init: RequestInit) => Promise<Response> = fetch): Promise<{ status: number; body: unknown }> {
  if (!env.sessionToken) return { status: 401, body: { error: { code: 'unauthorized' } } };
  if (!env.apiUrl) return { status: 503, body: { error: { code: 'console_not_configured' } } };
  const value = body as { password?: unknown; settings?: unknown } | null;
  if (!value || typeof value.password !== 'string' || typeof value.settings !== 'object' || value.settings === null) {
    return { status: 400, body: { error: { code: 'invalid_request' } } };
  }
  try {
    const response = await fetcher(new URL('/api/v1/me/settings', env.apiUrl).toString(), {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.sessionToken}` },
      body: JSON.stringify({ password: value.password, settings: value.settings }),
    });
    return { status: response.status, body: await response.json() };
  } catch {
    return { status: 502, body: { error: { code: 'upstream_unavailable' } } };
  }
}
