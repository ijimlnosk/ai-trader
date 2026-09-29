export async function authRequest(path: 'login' | 'logout', body: unknown, token?: string): Promise<Response> {
  if (!process.env.CONSOLE_API_URL) return Response.json({ error: { code: 'auth_unavailable' } }, { status: 503 });
  try {
    return await fetch(new URL(`/api/v1/auth/${path}`, process.env.CONSOLE_API_URL), {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    });
  } catch { return Response.json({ error: { code: 'auth_unavailable' } }, { status: 503 }); }
}
