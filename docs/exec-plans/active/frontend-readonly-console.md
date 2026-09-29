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
- The console, like the API, binds to loopback and is reached through an SSH tunnel; no public
  ingress or login system in v1.
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
- [ ] 3. Scaffold `apps/web` (Next.js, TanStack Query), lint/typecheck/build wired into repo gates.
- [ ] 4. Server-side proxy route with fixed GET allow-list and timeout; tests.
- [ ] 5. Panels: safety banner, portfolio, snapshots, loop runs, orders. Stale/error states.
- [ ] 6. Deploy (loopback-only), SSH-tunnel access check, document.

# Decisions

- Separate read token instead of reusing the order token (least privilege; a leaked console
  token cannot place orders). Status endpoint exposes flags, never secrets or account numbers.
- BFF proxy with allow-list instead of CORS to the API, so the token never reaches the browser.

# Progress

2026-09-29: plan rewritten for implementation after Phase 7 and the data pipeline.
2026-09-29: steps 1–2 done. `GET /api/v1/console/{status,orders,loop-runs,snapshots}`, limit 1–100
(default 20), read token required, 503 `console_disabled` without it. 512 tests passed; DB suite
15/15 on a disposable PostgreSQL.

# Validation

Server unit/route tests; web typecheck/lint/build; proxy tests for allow-list, missing token and
upstream errors; manual check through the tunnel. Repository gates must include `apps/web`.

# Remaining Work

All steps.
