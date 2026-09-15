# Goal
KIS paper-only token cache, domestic quote and broker status HTTP APIs.
# Constraints
No orders, AI, risk engine, Redis, DB changes or live endpoint. Never expose secrets.
# Current State
Implementation and all required local repository checks complete; deployment verification is operator-side.
# Plan
- [x] Add contracts, read-only application port and safe errors.
- [x] Implement validated KIS transport, token cache and quote adapter.
- [x] Wire routes, environment and Compose variables.
- [x] Add stub-only tests, documentation and run all repository checks.
# Decisions
Allow only the paper origin, disable redirects, bound HTTP requests to ten seconds.
Process-local single-flight token cache, 60-second expiry margin; no automatic request retries.
Status probes 005930 through the quote API, so reachable reflects a current authenticated request.
Quote timestamp is UTC receipt time, not exchange trade time; prices/change are KRW,
changeRate is percentage points and volume is cumulative shares. Financial values remain strings.
# Progress
Read all requested rules and existing code; checked official KIS token/quote examples.
Implemented application/domain contracts, KIS adapter, routes, environment and Compose wiring.
Added stub-only adapter/HTTP tests and documented API semantics and deployment.
# Validation
- pnpm typecheck: passed.
- pnpm lint: passed, including dependency restrictions.
- pnpm test: 59 tests passed in four files (22 existing, 37 added); no KIS/DB network calls.
- pnpm build: passed.
- Token issuance, reuse, early/expired refresh, concurrent success/failure, recovery,
  timeout, stale-token invalidation and malformed response coverage passed.
- Quote mapping preserves exact decimal/integer strings, HTTP symbol/error/status and
  actual log-stream/response sanitization tests passed.
- git diff --check passed; .env ignored; no credentials, live URL or order methods added.
- Existing PostgreSQL service, volumes, networks and healthcheck unchanged.
- Docker CLI is absent (command not found), so image build/Compose execution unavailable.
- No actual KIS connectivity or deployed-server verification was performed.
# Remaining Work
On the existing Docker host, build/recreate only server and verify the two read-only endpoints
using README commands. No migration is needed. Docker image and real KIS connectivity remain unverified locally.
