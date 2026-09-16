# Goal
Preserve safe KIS failure diagnostics with operation, transaction ID and HTTP status.
# Constraints
Generic HTTP errors, no secrets/msg1/headers, unchanged risk policy and balance mode.
# Evidence
Existing session logs balance message codes only after successful HTTP transport. Non-2xx
responses discard bodies before the session can inspect them; quote failures have no diagnostics.
Rechecked official current and legacy samples: retain all-balance INQR_DVSN=00/PRCS_DVSN=00.
# Plan
- [x] Add safe response observation before HTTP error mapping and operation context
- [x] Extend production-path tests for HTTP/business failures, secrecy and risk fail-closed behavior
- [x] Update documentation and run typecheck/lint/test/build
# Progress
Response observation now captures valid non-zero KIS envelopes before HTTP status mapping.
Diagnostics include allowlisted operation/TR context, message code and actual HTTP status.
Runtime logging supports both quotes and balances. Existing secret filtering remains in place.
Worktree initially clean; balance parameters, risk policies and order boundaries unchanged.
# Validation
- pnpm typecheck, pnpm lint, pnpm test, pnpm build: passed.
- 269 tests across 14 files passed (10 new cases; existing diagnostic assertions strengthened).
- Tested 200 business errors and HTTP 400/401/403/429/500/503 with provider message codes.
- Quote and balance operations/TR IDs distinguished; unknown context does not leak raw strings.
- Logs exclude credentials, account, DATABASE_URL, headers and msg1; HTTP does not expose KIS codes.
- Risk rejects provider failure; non-JSON failed HTTP responses retain generic mappings.
- Existing full balance parameter/TR, successful mapping and pagination tests passed.
- git diff --check passed.
# Remaining work
No implementation work remains. Deployment/real KIS account verification not performed;
the production failure's exact message code must be observed after deployment.
