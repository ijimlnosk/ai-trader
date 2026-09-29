import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as login } from '../../app/api/auth/login/route';
import { POST as logout } from '../../app/api/auth/logout/route';
import { GET as consoleGet } from '../../app/api/console/[...path]/route';
const token = 'a'.repeat(64);
const state = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('@/shared/auth/session', () => ({ sessionToken: async () => state.token }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); state.token = undefined; });
function request(path: string, origin: string | null = 'https://trader.jjinsol.com') {
  vi.stubEnv('CONSOLE_PUBLIC_ORIGIN', 'https://trader.jjinsol.com');
  vi.stubEnv('CONSOLE_API_URL', 'http://backend:3000');
  vi.stubEnv('NODE_ENV', 'production');
  return new NextRequest(`https://trader.jjinsol.com/api/auth/${path}`, { method: 'POST',
    headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.test', password: 'test-password-123' }) });
}
it('sets an HttpOnly secure host cookie and never sends the session token as browser JSON', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ token, expiresAt: '2030-01-01T00:00:00Z' }))));
  const response = await login(request('login'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get('cache-control')).toBe('no-store');
  for (const attribute of ['__Host-trader_session=', 'HttpOnly', 'Secure', 'SameSite=strict', 'Path=/']) expect(response.headers.get('set-cookie')).toContain(attribute);
  expect(response.headers.get('set-cookie')).not.toContain('Domain=');
});
it('blocks missing and cross-site login/logout before upstream work', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const origin of [null, 'https://evil.test']) {
    expect((await login(request('login', origin))).status).toBe(403);
    expect((await logout(request('logout', origin))).status).toBe(403);
  }
  expect(fetcher).not.toHaveBeenCalled();
});
it('keeps failed logins out of cookies, and clears cookies only after confirmed logout', async () => {
  const fetcher = vi.fn(async () => new Response('{}', { status: 401 })); vi.stubGlobal('fetch', fetcher);
  expect((await login(request('login'))).headers.get('set-cookie')).toBeNull();
  state.token = token;
  fetcher.mockImplementationOnce(async () => new Response(null, { status: 204 }));
  const response = await logout(request('logout'));
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  expect(fetcher).toHaveBeenLastCalledWith(expect.any(URL), expect.objectContaining({ headers: expect.objectContaining({ authorization: `Bearer ${token}` }) }));
  fetcher.mockImplementationOnce(async () => new Response('{}', { status: 503 }));
  const failed = await logout(request('logout'));
  expect(failed.status).toBe(503); expect(failed.headers.get('set-cookie')).toBeNull();
});
it('rejects an unauthenticated BFF read even when a machine token is configured', async () => {
  vi.stubEnv('CONSOLE_READ_TOKEN', 'r'.repeat(32));
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const response = await consoleGet(new NextRequest('https://trader.jjinsol.com/api/console/orders'), { params: Promise.resolve({ path: ['orders'] }) });
  expect(response.status).toBe(401); expect(fetcher).not.toHaveBeenCalled();
});
