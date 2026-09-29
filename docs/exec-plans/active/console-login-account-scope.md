# Goal

Protect the publicly deployed console with login and server-enforced user/account isolation.
Unauthenticated visitors must not obtain portfolio, orders, loop runs or operator state through
web proxies or direct API reads. Preserve read-only UI and deterministic trading boundaries.

# Constraints

- Existing deployment has one configured KIS paper account. Bind it explicitly to an operator;
  never implicitly grant new users access. Unlinked users see an account-not-connected state.
- No broker credentials in browser/session responses; user sessions cannot authorize order/tick APIs.
- User identity/account scope comes from validated server-side session records, not request IDs.
- Password or provider selection pending user preference; default administrator-created email/password.
- No public registration, credential collection in chat, speculative multi-broker trading, billing,
  role hierarchy, password-email service or live trading.
- Keep all existing trading switches and collection schedule unchanged.

# Plan

- [x] Inspect existing web proxy, console repository, public reads and deployment boundaries.
- [x] Add durable users, revocable sessions and explicit unique account ownership with additive migration.
- [x] Implement login/logout/session, credential throttling and user-scoped read-only API routes.
- [x] Protect legacy direct broker/account reads and eliminate web service-token data access.
- [x] Add login UI, HttpOnly secure sessions, origin validation, logout cache clearing and empty state.
- [x] Test unauthenticated, disabled/expired/revoked sessions, two-user isolation and forged account inputs.
- [x] Run repository gates and isolated DB checks, document administration/recovery and architecture.
- [x] Deploy with backup; verify public requests rejected and per-user access without financial writes.
- [ ] Provision the designated owner securely once its login identity is supplied.

# Decisions

Use one explicit ownership record per configured execution account. No historical financial rows
are reassigned. Ownership changes invalidate old access on the next request. Machine read/order
tokens remain separate from user login sessions. The backend validates authorization for every
user data endpoint; page redirects alone are insufficient.

# Progress

2026-09-29: public exposure verified. Web BFF currently injects a shared read token for any visitor;
direct portfolio was unauthenticated. Existing working tree clean at task start (b5d5356).

# Validation

- Lint, typecheck and production build passed.
- 543 regular tests passed; 20 database tests separately passed in disposable PostgreSQL 17.
- DB checks cover ownership uniqueness, persisted sessions, concurrent rate budgets, reset revocation,
  stale-credential login rejection, binding, and all existing order/ledger migration checks through 0006.
- Next handler tests verify cookie attributes, no token in JSON, cross-origin rejection, logout and
  no anonymous machine-token fallback. HTTP tests cover owner/other/unlinked identities and no order access.
- Operational preflight: source matches baseline except deployment-specific Compose; preserve its DB/network.
  paper/live false, execution/loop/tick false, daily collection true. Existing orders/fills/executions 4 each,
  loop runs 1, strategy runs 1. Pre/post financial row digests will be compared during deployment.

2026-09-29 23:50 KST: deployed (commits `2dc3087`, `7a3f25e`). Evidence:
`/home/jinsol/ai-trader-backups/auth-deploy-20260929` (source, `.env`, Compose, DB dump with
`pg_restore --list` ok, before/after snapshots). Images built; migration 0006 applied (7 migrations);
server and web recreated healthy. Switches unchanged (paper; live/execution/loop/tick false;
collection true). Web has neither machine token; origin `https://trader.jjinsol.com`. Ledger hashes
and loop count unchanged; 0 users, 0 sessions.

Public checks (anonymous, over HTTPS): `trader.jjinsol.com/` 307 to `/login`, `/login` 200, all seven
`/api/console/*` 401; `trader-api.jjinsol.com` portfolio, broker status, quote, legacy console,
`/me/console`, `/auth/me` and risk evaluate 401; `/health` 200; cross-origin login POST 403.
Before this deployment (since the Cloudflare hostnames were added, observed 18:45 KST) the earlier
unauthenticated build exposed paper balances, orders and switch state publicly; no order path was
reachable (execution off, order token required).

Owner login with account ownership was not yet exercised in production (no user exists).

# Remaining Work

Provision the owner: the operator runs `python3 scripts/console-user.py create --bind-configured-account`
locally and types email/password at the prompts (never in chat). Then verify owner login, data
reads, logout replay rejection and that an unlinked user gets 403. The disposable auth test DB
container `ai-trader-auth-test-20260929` on the host can be removed when no longer needed.
