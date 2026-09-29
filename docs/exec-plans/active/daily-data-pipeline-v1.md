# Goal

Replace the operator's out-of-repository collection script and manual calendar cross-check with a
server-owned, auditable daily pipeline for `005930`: a reviewed KRX session calendar, archived KIS
daily bars and deterministic preparation of the paper-loop input. The paper loop can then run on a
calendar session without hand-built requests, still behind both default-off opt-ins.

# Constraints

- Paper only, `005930` only. No AI, live mode, strategy/risk/sizing change or new symbols.
- Never invent, forward-fill or silently substitute bars. Missing, stale, revised-without-record or
  calendar-mismatched data results in skip with a reason code, never a trade.
- The calendar is explicit, versioned data with cited sources. A date outside its coverage is
  unknown and skips. No guessing holidays from weekdays alone.
- Preserve the existing freshness (96 h), next-session and 09:00–15:20 Seoul order-window guards.
  Holiday gaps become supported only through the reviewed calendar, not by relaxing guards.
- KIS reads share the existing paced client; quotation GET only; no retries of order transport.
- The existing `POST /api/v1/strategy/schedule` and `/paper-loop/tick` contracts stay unchanged.
- Data collection runs only after the 15:30 KST close of the bar it archives (+ margin), so an
  unfinished intraday bar can never enter a dataset.

# Current State

- `collect.mjs` (server-private) calls `FHKST03010100` (period D, raw prices, max 100 bars),
  maps `output2`, validates with `datasetSchema` and hashes `JSON.stringify(data)`.
- Calendar: `calendar.json` built by hand from securities-firm closure notices (2026-09-28).
- `paperLoopInputSchema` requires calendar sessions = dataset sessions + declared session, and
  `eligibleLoopSession` requires the declared session to be the next calendar *weekday* after the
  last bar, so a Monday holiday or mid-week closure currently cannot be traded (safe skip).
- The KIS domestic holiday API (`chk-holiday`, CTCA0903R) is believed unsupported for the paper
  (VTS) domain; not verified. The design does not depend on it.
- No DB table archives market data; evidence lives in private files on the server.

# Plan

Phase A — order-free (deployable with execution off)

- [x] A1. Domain calendar: `domain/market/krxCalendar.ts` with an explicit 2026 closure list,
      coverage range and source list; `isKrxSession`, `nextKrxSession`, `krxSessionsBetween`.
      Tests: weekends, each listed closure, coverage boundaries, out-of-coverage = unknown.
- [x] A2. Application port `DailyHistorySource.getDailyBars(symbol, from, to)`; KIS adapter for
      `FHKST03010100` with zod-validated response and explicit field mapping. Tests use stubs.
- [x] A3. Additive migration `market_daily_snapshots`: symbol, completed-through date, collected
      at, source/params, raw response SHA-256, normalized dataset, dataset SHA-256, revision
      summary vs previous snapshot. Unique (symbol, through, dataset digest).
- [x] A4. Use case `collectDailySnapshot(now)`: require after close + margin on a calendar session,
      fetch, validate bars exactly equal calendar sessions in range, record revisions of older bars
      explicitly, persist. Idempotent for identical data.
- [x] A5. Use case `preparePaperLoopInput(sessionDate)`: require calendar session, latest snapshot
      whose through-date is the previous calendar session, build `PaperLoopInput` with calendar
      source = calendar version and deterministic run key. Returns a skip reason otherwise.
- [x] A6. Authenticated read/dry endpoints (collect now, preview prepared input) for commissioning.
- [x] A7. Relax `eligibleLoopSession` from "next weekday" to "next reviewed calendar session"
      (still requires ≤96 h freshness, so long holiday gaps still skip). Decision record required.

Phase B — scheduling (separate approval before enabling)

- [ ] B1. Same-process daily timer: collect after close; at session open prepare then tick via the
      existing trigger semantics. Default off, no catch-up, stops on HALTED/exception.
- [ ] B2. Deploy disabled, run A-phase collection/preview for at least two sessions, then a
      bounded enabled session. Record evidence.

# Decisions

- Calendar as reviewed repository data (source-cited, yearly update) instead of a live API,
  because the paper credentials cannot be assumed to reach the holiday API and an unverified API
  answer is not stronger than cited notices. Revisit if a verified official source is available.
- KIS bars must match the calendar exactly within the collected range; disagreement skips and
  is reported (either the calendar or the data is wrong; neither is auto-corrected).
- 96-hour freshness is kept. Consequence: after closures longer than ~2 sessions the loop skips.

# Progress

2026-09-29: plan drafted after inspecting market dataset validation, loop input/eligibility,
scheduler, KIS session and the private collection/calendar evidence.

2026-09-29: Phase A implemented locally (not deployed, not committed at time of writing).
Calendar sources: prior manual cross-check plus Investing.com holiday calendar for 10/05, 10/09,
12/25. Gates: lint, typecheck, build passed; `pnpm test` 484 passed, 14 DB cases skipped there and
run separately against a disposable PostgreSQL 17 on sol-server loopback (14/14 passed, including
JSONB digest round trip and snapshot → prepared input).

- 2026-12-31 has no 2026 source yet (only the 2025 year-end notice); calendar coverage ends
  2026-12-30. The next extension needs the 2026 year-end notice and the 2027 closures.
- The strategy service had its own next-weekday execution guard. Both it and the loop now use the
  calendar; otherwise a post-holiday tick would pass loop admission, fail in strategy and leave a
  HALTED claim blocking all later ticks. Regression test added.
- Collection waits until 18:30 KST because KIS daily volume includes after-hours trading.

# Validation

Per step: unit tests for calendar/mapping/revision/skip reasons; disposable-DB tests for the
snapshot repository; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Deployment
evidence: collected snapshot equals an independent manual KIS pull; prepared input digest equals
the operator-built digest for the same data.

# Remaining Work

- Phase A deployed disabled 2026-09-29 14:01 KST; collection through 9/28 and the prepared 9/29
  input matched the independent Phase 5 dataset. See [deployment](../../DATA_PIPELINE_DEPLOY_2026-09-29.md).
- After 18:30 KST 9/29: collect through 9/29 and compare with a manual pull; on 9/30 confirm the
  prepared input. Then Phase B (needs separate approval before enabling).
