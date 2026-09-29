import { describe, expect, it, vi } from 'vitest';
import { proxyConsoleRequest } from './consoleProxy';

const env = { apiUrl: 'http://127.0.0.1:3200', sessionToken: 'a'.repeat(64) };
const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('console proxy', () => {
  it('forwards allow-listed GETs with the individual session and limit only', async () => {
    const fetcher = ok({ items: [] });
    const result = await proxyConsoleRequest(['orders'], new URLSearchParams('limit=50'), env, fetcher);
    expect(result).toEqual({ status: 200, body: { items: [] } });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3200/api/v1/me/console/orders?limit=50');
    expect(init).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { authorization: `Bearer ${env.sessionToken}` } });
  });

  it.each([[['status'], '/api/v1/me/console/status'], [['health'], '/api/v1/me/console/health'], [['portfolio'], '/api/v1/me/console/portfolio'],
    [['broker-status'], '/api/v1/me/console/broker-status']])('maps %j to %s', async (segments, path) => {
    const fetcher = ok({});
    await proxyConsoleRequest(segments, new URLSearchParams(), env, fetcher);
    expect((fetcher.mock.calls[0] as unknown as [string])[0]).toBe(`http://127.0.0.1:3200${path}`);
  });

  it.each([[['orders', 'x']], [['tick']], [['__proto__']], [['constructor']], [[]], [['..', 'orders']]])('rejects %j', async (segments) => {
    const fetcher = ok({});
    expect(await proxyConsoleRequest(segments, new URLSearchParams(), env, fetcher)).toEqual({ status: 404, body: { error: { code: 'not_found' } } });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['limit=1000', 'limit=-1', 'limit=a', 'limit=1&limit=2', 'other=1', 'limit=1&x=2'])('rejects query %s', async (query) => {
    const fetcher = ok({});
    expect((await proxyConsoleRequest(['orders'], new URLSearchParams(query), env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects limit on non-list routes', async () => {
    expect((await proxyConsoleRequest(['status'], new URLSearchParams('limit=5'), env, ok({}))).status).toBe(400);
  });

  it('never falls back to machine credentials without a valid session', async () => {
    for (const partial of [{ apiUrl: env.apiUrl }, { ...env, sessionToken: 'invalid' }, {}]) {
      const fetcher = ok({});
      expect((await proxyConsoleRequest(['status'], new URLSearchParams(), partial, fetcher)).status).toBe(401);
      expect(fetcher).not.toHaveBeenCalled();
    }
    expect((await proxyConsoleRequest(['status'], new URLSearchParams(), { sessionToken: env.sessionToken }, ok({}))).status).toBe(503);
  });

  it('passes upstream error bodies through and maps transport failures', async () => {
    expect(await proxyConsoleRequest(['status'], new URLSearchParams(), env, ok({ error: { code: 'unauthorized' } }, 401)))
      .toEqual({ status: 401, body: { error: { code: 'unauthorized' } } });
    const failing = vi.fn(async () => { throw new Error(`token ${env.sessionToken}`); });
    const result = await proxyConsoleRequest(['status'], new URLSearchParams(), env, failing);
    expect(result).toEqual({ status: 502, body: { error: { code: 'upstream_unavailable' } } });
    const html = vi.fn(async () => new Response('<html>', { status: 200 }));
    expect((await proxyConsoleRequest(['status'], new URLSearchParams(), env, html)).status).toBe(502);
  });
});
