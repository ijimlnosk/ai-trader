import { describe, expect, it, vi } from 'vitest';
import { proxyConsoleRequest } from './consoleProxy';

const env = { apiUrl: 'http://127.0.0.1:3200', readToken: 'r'.repeat(32) };
const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('console proxy', () => {
  it('forwards allow-listed GETs with the server-held token and limit only', async () => {
    const fetcher = ok({ items: [] });
    const result = await proxyConsoleRequest(['orders'], new URLSearchParams('limit=50'), env, fetcher);
    expect(result).toEqual({ status: 200, body: { items: [] } });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3200/api/v1/console/orders?limit=50');
    expect(init).toMatchObject({ method: 'GET', redirect: 'error', cache: 'no-store', headers: { authorization: `Bearer ${env.readToken}` } });
  });

  it.each([[['status'], '/api/v1/console/status'], [['health'], '/health'], [['portfolio'], '/api/v1/portfolio'],
    [['broker-status'], '/api/v1/broker/status']])('maps %j to %s', async (segments, path) => {
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

  it('fails closed without configuration', async () => {
    for (const partial of [{ apiUrl: env.apiUrl }, { readToken: env.readToken }, {}]) {
      expect(await proxyConsoleRequest(['status'], new URLSearchParams(), partial, ok({})))
        .toEqual({ status: 503, body: { error: { code: 'console_not_configured' } } });
    }
  });

  it('passes upstream error bodies through and maps transport failures', async () => {
    expect(await proxyConsoleRequest(['status'], new URLSearchParams(), env, ok({ error: { code: 'unauthorized' } }, 401)))
      .toEqual({ status: 401, body: { error: { code: 'unauthorized' } } });
    const failing = vi.fn(async () => { throw new Error(`token ${env.readToken}`); });
    const result = await proxyConsoleRequest(['status'], new URLSearchParams(), env, failing);
    expect(result).toEqual({ status: 502, body: { error: { code: 'upstream_unavailable' } } });
    const html = vi.fn(async () => new Response('<html>', { status: 200 }));
    expect((await proxyConsoleRequest(['status'], new URLSearchParams(), env, html)).status).toBe(502);
  });
});
