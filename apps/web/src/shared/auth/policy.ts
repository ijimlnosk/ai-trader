export const SESSION_COOKIE = '__Host-trader_session';
export const LOCAL_SESSION_COOKIE = 'trader_session';
export function sessionCookie(production: boolean) { return production ? SESSION_COOKIE : LOCAL_SESSION_COOKIE; }
export function allowedOrigin(origin: string | null, expected: string | undefined): boolean {
  if (!origin || !expected) return false;
  try { return new URL(origin).origin === new URL(expected).origin; } catch { return false; }
}
