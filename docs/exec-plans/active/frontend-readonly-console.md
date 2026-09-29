# Goal

A private, read-only paper operator console (`apps/web`) that shows safety state, portfolio,
daily snapshots, paper-loop runs and orders, so daily automatic ticks can be reviewed. No order,
tick, collection or configuration action exists in the console.

# Constraints

- Browser code holds no secrets and never calls the broker or order-capable endpoints.
- `ORDER_API_TOKEN` authorizes orders; the console must not use it. A separate
  `CONSOLE_READ_TOKEN` (≥32 chars, different from the order token) authorizes read endpoints only.
- The token lives only in the Next.js server runtime (route handlers proxy a fixed allow-list of
  GET paths). The browser talks to same-origin `/api/console/*` without credentials.
- The console, like the API, binds to loopback (host port 3201; 3100 is taken on the host) and
  is reached through an SSH tunnel; no public ingress or login system in v1.
- Paper vs live must be visually unambiguous. Money/quantities remain exact strings.
- Next.js App Router, TanStack Query for server state; Zustand only for genuine client state.

# Current State

- Unauthenticated loopback reads exist: `/health`, `/api/v1/portfolio`, `/api/v1/market/:symbol/quote`,
  `/api/v1/broker/status`. `GET /api/v1/orders/:id` requires the order token.
- No list endpoints for orders, loop runs or snapshots; no runtime-flag status endpoint.
- No `apps/web` package.

# Plan

- [x] 1. Contracts: console status, order list, loop-run summary, snapshot summary responses.
- [x] 2. Server: `CONSOLE_READ_TOKEN` env (optional; distinct from order token); read-only
      `GET /api/v1/console/{status,orders,loop-runs,snapshots}` with bounded `limit`; repository
      list queries (account-scoped for orders/runs); tests.
- [x] 3. Scaffold `apps/web` (Next.js, TanStack Query), lint/typecheck/build wired into repo gates.
- [x] 4. Server-side proxy route with fixed GET allow-list and timeout; tests.
- [x] 5. Panels: safety banner, portfolio, snapshots, loop runs, orders. Stale/error states.
- [x] 6. Deploy (loopback-only), SSH-tunnel access check, document.

# Decisions

- Separate read token instead of reusing the order token (least privilege; a leaked console
  token cannot place orders). Status endpoint exposes flags, never secrets or account numbers.
- BFF proxy with allow-list instead of CORS to the API, so the token never reaches the browser.

# Progress

2026-09-29: plan rewritten for implementation after Phase 7 and the data pipeline.
2026-09-29: steps 1–2 done. `GET /api/v1/console/{status,orders,loop-runs,snapshots}`, limit 1–100
(default 20), read token required, 503 `console_disabled` without it. 506 tests passed; DB suite
15/15 on a disposable PostgreSQL.
2026-09-29: steps 3–5 done. `apps/web` (Next.js 16.3, React 19.3, TanStack Query 5.104) with a
server-side proxy `/api/console/<name>` (allow-list: status, orders, loop-runs, snapshots,
portfolio, health, broker-status; `limit` only; 10 s timeout; env `CONSOLE_API_URL`,
`CONSOLE_READ_TOKEN`). Panels: safety banner, portfolio, loop runs, orders, snapshots; stale data
stays visible with a warning. ESLint forbids web imports of server code. Gates: lint, typecheck,
528 tests, build (server + web). Local check against a mock upstream: 404 for unknown names, 405
for POST, token absent from HTML, page renders PAPER banner with no browser console errors.
2026-09-29 15:25 KST: deployed to sol-server (see [deployment](../../DATA_PIPELINE_DEPLOY_2026-09-29.md)).
Runbook: [CONSOLE.md](../../CONSOLE.md).

# Validation

Server unit/route tests; web typecheck/lint/build; proxy tests for allow-list, missing token and
upstream errors; manual check through the tunnel. Repository gates must include `apps/web`.

# Remaining Work

v1 complete. Possible follow-ups: consolidate the four duplicated bearer checks in server routes;
show daily-schedule events once they are persisted (currently logs only).
