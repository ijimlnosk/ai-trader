import { describe, expect, it, vi } from 'vitest';
import { forwardAutoTradingControl } from './forwardControl';

const env = { apiUrl: 'http://server:3000', sessionToken: 'a'.repeat(64) };
const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('auto trading control forwarding', () => {
  it('forwards only enabled and, when resuming, the password with the session bearer', async () => {
    const fetcher = ok({ autoTrading: {} });
    await forwardAutoTradingControl({ enabled: true, password: 'p'.repeat(15), liveTradingEnabled: true }, env, fetcher);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://server:3000/api/v1/me/controls/auto-trading');
    expect(JSON.parse(String(init.body))).toEqual({ enabled: true, password: 'p'.repeat(15) });
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${env.sessionToken}` } });
    await forwardAutoTradingControl({ enabled: false, password: 'ignored-password' }, env, fetcher);
    expect(JSON.parse(String((fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].body))).toEqual({ enabled: false });
  });

  it('fails closed without a session, configuration or a boolean', async () => {
    const fetcher = ok({});
    expect((await forwardAutoTradingControl({ enabled: false }, { apiUrl: env.apiUrl }, fetcher)).status).toBe(401);
    expect((await forwardAutoTradingControl({ enabled: false }, { sessionToken: env.sessionToken }, fetcher)).status).toBe(503);
    for (const body of [null, {}, { enabled: 'true' }, []]) expect((await forwardAutoTradingControl(body, env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('passes upstream errors through and maps transport failures', async () => {
    expect(await forwardAutoTradingControl({ enabled: true, password: 'x' }, env, ok({ error: { code: 'password_incorrect' } }, 403)))
      .toEqual({ status: 403, body: { error: { code: 'password_incorrect' } } });
    const failing = vi.fn(async () => { throw new Error('boom'); });
    expect((await forwardAutoTradingControl({ enabled: false }, env, failing)).status).toBe(502);
  });
});
