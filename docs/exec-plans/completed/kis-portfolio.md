# Goal
Read-only KIS paper account portfolio through GET /api/v1/portfolio.
# Constraints
Reuse the existing token provider/cache across quote and portfolio. No orders or DB writes.
Preserve paper-only origin, secrets isolation and inward dependency boundaries.
# Current State
Read-only portfolio implementation and required local checks are complete.
# Plan
- [x] Add Portfolio/Position, AccountBroker use case and HTTP contract.
- [x] Reuse authentication; validate/map paginated KIS balances.
- [x] Add stub-only mapping, error, pagination, cache-sharing and API secrecy tests.
- [x] Document semantics/deployment and run typecheck/lint/test/build.
# Decisions
Use VTTC8434R, symbol-level balances, account number 8 digits + product code 2 digits.
Cash = deposit total; totalEvaluation = KIS total evaluation; P/L is holdings valuation P/L.
Total P/L percentage uses exact BigInt decimal arithmetic, two places, half away from zero.
Zero purchase and zero P/L returns 0.00; zero purchase with nonzero P/L is invalid.
Follow F/M continuation with N requests spaced one second apart; cap 20 pages and reject loops/duplicates/inconsistent
summaries rather than return an incomplete portfolio. Zero-quantity historical rows are omitted.
Missing summary means account_unavailable; malformed fields remain provider_invalid_response.
# Progress
Rules and existing code read. Official KIS request/column mapping checked.
Shared authenticated KIS session, validated portfolio pagination/mapping, exact rate calculation,
HTTP/application contracts and safe errors implemented. Documentation and stub tests added.
# Validation
- pnpm typecheck: passed.
- pnpm lint: passed.
- pnpm test: 117 passed in six files (59 existing + 58 added).
- pnpm build: passed.
- git diff --check: passed; .env remains ignored.
- Tested empty/multiple positions, numeric precision/rounding, zero-cost semantics, zero quantities,
  malformed responses, missing account summary/config, HTTP/business failures and secret omission.
- Pagination coverage: F/M/N continuation, cursors, missing headers, loops, duplicates, inconsistent
  summaries, later failure, 20-page limit and blank search condition with an advancing page key.
- Actual createApp composition shares one token issuance for concurrent quote + portfolio requests.
- No token-provider logic duplication, domain/interface infrastructure imports, orders, live URL,
  DB schema changes or Compose volume/network changes.
- No actual KIS account query, production deployment or Docker image build was performed.
# Remaining Work
Operator-side verification: deploy server in the existing Compose project and call portfolio
using the README commands. This change requires no database migration.

# Changed files
- `.env.example`
- `README.md`
- `apps/server/src/app/createApp.ts`
- `apps/server/src/app/market.test.ts`
- `apps/server/src/application/brokerError.ts`
- `apps/server/src/application/portfolio.ts`
- `apps/server/src/domain/portfolio.ts`
- `apps/server/src/domain/portfolioProfitLossRate.test.ts`
- `apps/server/src/domain/portfolioProfitLossRate.ts`
- `apps/server/src/infrastructure/broker/kis/index.ts`
- `apps/server/src/infrastructure/broker/kis/kis.test.ts`
- `apps/server/src/infrastructure/broker/kis/kisClient.ts`
- `apps/server/src/infrastructure/broker/kis/kisPortfolio.test.ts`
- `apps/server/src/infrastructure/broker/kis/kisPortfolioAdapter.ts`
- `apps/server/src/infrastructure/broker/kis/kisPortfolioMapping.ts`
- `apps/server/src/infrastructure/broker/kis/kisPortfolioSchemas.ts`
- `apps/server/src/infrastructure/broker/kis/kisSchemas.ts`
- `apps/server/src/infrastructure/broker/kis/kisSession.ts`
- `apps/server/src/interfaces/http/brokerErrors.ts`
- `apps/server/src/interfaces/http/market.ts`
- `apps/server/src/interfaces/http/portfolio.ts`
- `docs/ARCHITECTURE.md`
- `docs/decisions/0002-portfolio-valuation-semantics.md`
- `docs/exec-plans/completed/kis-portfolio.md`
- `packages/contracts/src/index.ts`
