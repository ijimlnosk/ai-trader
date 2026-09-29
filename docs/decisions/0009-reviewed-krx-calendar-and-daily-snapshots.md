# 0009 — Reviewed KRX calendar and archived daily snapshots

Date: 2026-09-29. Status: accepted.

The paper loop needed an operator to fetch KIS daily bars, cross-check a hand-built calendar and
hash a request outside the repository. The loop also rejected any session after a weekday closure,
because eligibility used "next calendar weekday".

## Calendar

Use a source-cited, versioned KRX calendar in `domain/scheduler/krxCalendar.ts` with an explicit
coverage range. Dates outside coverage are `unknown`; callers skip. The paper KIS domain cannot be
assumed to serve the holiday API, and an unverified API answer is not stronger than cited notices.
The 2026 year-end closure lacks a 2026 source, so coverage ends 2026-12-30. Extending coverage is a
reviewed code change with sources and a new version string.

Loop eligibility now requires the declared session to be the next reviewed session after the last
bar. Unknown dates are ineligible. The 96-hour freshness limit is unchanged, so closures longer
than about two sessions still skip. An unannounced future closure is not predicted; the broker
rejects orders on a closed market and the existing execution path records that rejection.

## Snapshots

Archive calendar-aligned KIS daily bars in additive table `market_daily_snapshots` (migration 0005).
Collection runs only after 18:30 KST for the current session, because KIS includes after-hours
volume in the daily bar (observed revising 2026-09-28 volume after 15:50). Returned bars must equal
the calendar's sessions exactly; any gap, extra day or missing latest bar skips without saving.

Idempotency uses the symbol, completed-through date and a digest of sessions and candles only; the
dataset digest also covers the retrieval-time `source`. Changed earlier bars create a new snapshot
listing the revised dates. The loop binds its claim to the bar, so a revised dataset for an already
claimed bar returns a conflict instead of a second order.

JSONB reorders object keys. Snapshots are re-parsed into schema order on read and their dataset
digest rechecked; a mismatch is an error, never usable data.

## Consequences

`GET /api/v1/strategy/paper-loop/prepared` builds the tick input from the previous session's
snapshot; the tick endpoint and its admission checks are unchanged. Scheduling collection and ticks
automatically is separate work (plan phase B).

## Amendment 2026-09-30: morning confirmation

Observed 2026-09-29: the bar archived at 18:30 KST (close 273,000, volume 15,438,245) differed at
18:45 KST (close 273,500, volume 15,444,018). The 18:30 assumption was wrong. The 9/28 bar pulled
on the next morning matched later same-day pulls. Therefore the schedule also re-collects on each
session morning (08:00–08:50 KST, at most three attempts). Identical candles update
`confirmed_at` (migration 0007) instead of adding a row; revised candles create a new snapshot as
before. Loop preparation requires the previous session's snapshot to have been confirmed at or
after 08:00 KST on the session date, otherwise it skips the day (`snapshot_unconfirmed`). The
latest snapshot for a date is chosen by confirmation time.
