import { describe, expect, it, vi } from 'vitest';
import { forwardSettings } from './forwardSettings';

const env = { apiUrl: 'http://127.0.0.1:3200', sessionToken: 's'.repeat(64) };

describe('settings forwarder', () => {
  it('forwards only password and settings with the session', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await forwardSettings({ password: 'pw', settings: { dayPreset: 'day-v1' }, extra: 'x' }, env, fetcher);
    expect(result).toEqual({ status: 200, body: { ok: true } });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://127.0.0.1:3200/api/v1/me/settings');
    expect(JSON.parse(String(init.body))).toEqual({ password: 'pw', settings: { dayPreset: 'day-v1' } });
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${env.sessionToken}` } });
  });

  it.each([[null], [{}], [{ password: 1, settings: {} }], [{ password: 'pw', settings: null }]])('rejects %j before calling the server', async (body) => {
    const fetcher = vi.fn();
    expect((await forwardSettings(body, env, fetcher)).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('needs a session', async () => {
    expect((await forwardSettings({ password: 'pw', settings: {} }, { apiUrl: env.apiUrl }, vi.fn())).status).toBe(401);
  });
});
