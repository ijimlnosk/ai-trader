export class ConsoleRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

/** Browser-side call to the same-origin proxy; no credentials are held or sent by the browser. */
export async function fetchConsole<T>(name: string, limit?: number): Promise<T> {
  const query = limit === undefined ? '' : `?limit=${limit}`;
  const response = await fetch(`/api/console/${name}${query}`, { cache: 'no-store' });
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401 && typeof window !== 'undefined') window.location.replace('/login');
  if (response.status === 403 && typeof window !== 'undefined') window.location.replace('/');
  if (!response.ok) {
    const code = typeof body === 'object' && body !== null && 'error' in body
      && typeof (body as { error?: { code?: unknown } }).error?.code === 'string'
      ? (body as { error: { code: string } }).error.code : 'request_failed';
    throw new ConsoleRequestError(response.status, code);
  }
  return body as T;
}
