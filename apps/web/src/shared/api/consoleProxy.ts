/** Session-authorized read-only proxy. No shared service-token fallback. */
const ROUTES = {
  status: { path: '/api/v1/me/console/status', list: false },
  orders: { path: '/api/v1/me/console/orders', list: true },
  'loop-runs': { path: '/api/v1/me/console/loop-runs', list: true },
  snapshots: { path: '/api/v1/me/console/snapshots', list: true },
  portfolio: { path: '/api/v1/me/console/portfolio', list: false },
  health: { path: '/api/v1/me/console/health', list: false },
  'broker-status': { path: '/api/v1/me/console/broker-status', list: false },
  controls: { path: '/api/v1/me/console/controls', list: false },
} as const;

export interface ProxyEnvironment { apiUrl?: string | undefined; sessionToken?: string | undefined }
export interface ProxyResult { status: number; body: unknown }
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

const error = (status: number, code: string): ProxyResult => ({ status, body: { error: { code } } });

export async function proxyConsoleRequest(segments: readonly string[], search: URLSearchParams,
  env: ProxyEnvironment, fetcher: Fetcher = fetch, timeoutMs = 10000): Promise<ProxyResult> {
  const name = segments.length === 1 ? segments[0]! : '';
  if (!Object.hasOwn(ROUTES, name)) return error(404, 'not_found');
  const route = ROUTES[name as keyof typeof ROUTES];
  const keys = [...search.keys()];
  const limit = search.get('limit');
  if (keys.some((key) => key !== 'limit') || keys.length > 1 || (limit !== null && (!route.list || !/^\d{1,3}$/.test(limit)))) {
    return error(400, 'invalid_request');
  }
  if (!env.sessionToken || !/^[a-f0-9]{64}$/.test(env.sessionToken)) return error(401, 'unauthorized');
  if (!env.apiUrl) return error(503, 'console_not_configured');
  const url = new URL(route.path, env.apiUrl);
  if (limit !== null) url.searchParams.set('limit', limit);
  try {
    const response = await fetcher(url.toString(), { method: 'GET', redirect: 'error', cache: 'no-store',
      headers: { authorization: `Bearer ${env.sessionToken}` }, signal: AbortSignal.timeout(timeoutMs) });
    const body: unknown = await response.json();
    return { status: response.status, body };
  } catch {
    return error(502, 'upstream_unavailable');
  }
}
