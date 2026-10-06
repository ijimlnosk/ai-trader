# Goal

Owner request (2026-10-06): see in the console why momentum bought what it bought and what data is being
collected, without querying the database. Read-only.

# Constraints

- Read-only endpoint behind the existing session auth and proxy allow-list; no controls, no orders.
- Shared types only in `packages/contracts`; the web never imports server code.
- Owner's planned live capital is about KRW 500,000; show whether each candidate is buyable at that size
  (display only, it changes no rule).

# Plan

- [x] Contract `ConsoleInsightsResponse`.
- [x] Server: insight queries (momentum ranking, collection coverage, DART filings, take-profit signals),
      read repository, `GET /api/v1/me/console/insights`.
- [x] Web: proxy route, query hook, "판단 근거" tab with four cards.
- [x] Tests, typecheck, lint, build; deploy server and web (2026-10-06, `3470e4f`).

# Decisions

# Progress

2026-10-06: implemented; 668 tests, typecheck (contracts/server/web), lint and web build pass. Coverage SQL
checked read-only on production. ESLint now ignores the local `.agents/` skills (gitignored, not project code).

# Validation

# Remaining Work

Visual check of the tab in a browser (owner login required).
