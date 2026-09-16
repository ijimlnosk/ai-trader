# Goal
Implement deterministic Risk Engine v1 without any order capability.
# Constraints
Pure domain, exact decimal strings, paper only, no DB persistence or fabricated account state.
# Current State
Read all repository instructions, architecture and active plans. Working tree initially clean.
Portfolio cash is deposits, not buying power; realized loss and operational risk state are absent.
# Plan
- [x] Domain models, exact arithmetic, policy validation and evaluation
- [x] Injectable context application use case and debug HTTP route
- [x] Boundary, failure and HTTP tests
- [x] Architecture documentation and all four repository checks
# Decisions
Use bounded numeric(24,8)-compatible BigInt arithmetic without new dependencies.
Default context provider reports unavailable; fail closed instead of inventing safe values.
BUY count cap conservatively includes additional purchases; SELL skips BUY-specific controls.
# Progress
Implemented domain evaluation and validation, immutable policy, public contracts, injected
application context/clock, audit-ready snapshots and the registered debug route. Documented the
mandatory risk boundary and v1 limitations in architecture and decision 0003.
# Validation
- pnpm typecheck: passed (including test/tooling types).
- pnpm lint: passed.
- pnpm test: 199 passed across 9 files; 82 new tests across 3 risk test files.
- pnpm build: passed.
- git diff --check: passed.
- Reviewed dependency direction, exact arithmetic, no broker order methods or credentials added.
- Used installed pnpm 10.17.1 via its explicit PATH; no dependency or lockfile changes.
- Initial typecheck/build found unknown HTTP error typing; narrowed it and reran checks successfully.
# Remaining Work
None for v1. Future work: trusted available-cash/realized-loss/kill-switch context source,
freshness and sell-holdings validation before considering any execution feature.
