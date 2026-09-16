# Goal
Wire the production paper runtime to a portfolio-backed RiskContextProvider.
# Constraints
No policy changes, orders, persistence, live trading or secrets. Keep domain pure.
# Current State
Bootstrap now calls createRuntimeApp, which explicitly injects the portfolio-backed paper provider.
Read repository instructions, architecture, existing risk/portfolio models and active plans.
# Plan
- [x] Implement validated portfolio mapping and explicit paper v1 initial state
- [x] Require app dependencies and wire the provider in the production composition path
- [x] Test mapping, malformed data, failures and production-style HTTP evaluation
- [x] Update architecture/decision records and run all required checks
# Decisions
Use AccountBroker in application; share one KIS adapter across runtime consumers.
Use portfolio.cash as the explicitly requested paper v1 cash proxy; keep deposit semantics documented.
Malformed data returns null/INVALID_CONTEXT; broker exceptions remain sanitized application failures.
# Progress
Implemented application/paperRiskContext, extracted production composition to createRuntimeApp,
and made createApp dependencies mandatory with an explicit missing-provider error.
Updated existing tests to use production composition and added mapping/runtime regression coverage.
Architecture and decision 0004 document paper initialization and supersede the affected parts of 0003.
Working tree initially clean; policy/evaluation logic, broker implementation and dependencies unchanged.
# Validation
- pnpm typecheck, pnpm lint, pnpm test, pnpm build: passed.
- 239 tests passed across 11 files; 40 new tests, including real KIS adapter with mocked transport.
- Requested 1-share/70000 proposal approved with 10000000 cash/equity and no positions.
- Invalid portfolio rejected; malformed KIS responses/outages returned sanitized 503.
- Repeated evaluation reads fresh data; a later outage never reuses the prior good context.
- Production-style portfolio/risk requests share a KIS token; no external account calls in tests.
- Source and compiled bootstrap both inject the real provider; null providers exist only in explicit tests.
- git diff --check: passed. No order code, secrets or unrelated changes added.
# Remaining Work
None for this implementation. Deployment and verification against an actual running KIS account
were not performed. Authoritative operational risk state remains future work before execution.
