# Goal

Owner request (2026-10-07): an active intraday strategy for KRW 500,000 — buy what is likely to rise that day,
sell near the intraday high, cut or hold losers by a next-day signal, re-buy after a pullback, many times a day.
Start as a virtual (order-free) run on live quotes and accumulate data; change rules on evidence.

# Constraints

- Virtual only: no proposal, no order, no Risk Engine call, no broker write. Paper orders and live trading
  are later, separate approvals.
- Own KIS session with its own pacing so production quote/order calls are never queued behind it.
- Exact KRW arithmetic; costs per fill: commission 2 bp, sell tax 20 bp, slippage 10 bp.
- Persist every virtual fill so results survive restarts and can be audited.

# Plan

- [x] Low-price universe (100 symbols from the 2026-10-06 scan) and minute-bar collection for it.
- [x] Domain: rule set `day-v1` (entry, +5% target, trailing, stop, close decision, re-buy) and ledger replay.
- [x] Application: minute step (09:01 sweep → watchlist, then entries/exits/re-buys until 15:15/15:20).
- [x] Persistence: `shadow_trades` (insert-only); env flag `SHADOW_DAY_TRADING_ENABLED` (default false).
- [x] Console: daily results and recent virtual trades.
- [x] Tests, deploy, enable (2026-10-07; shared KIS gate after rate-limit collisions).

# Decisions

Initial rule values (owner-approved direction, 2026-10-07): 3 positions × 1/3 of cash; entry from morning
strength; sell at +5% or after +3% when 1.5% below the high since entry; stop at −3%; at 15:15 sell winners,
hold losers only if above the session's first price; re-buy 2% below the last sell price (at most 3 per symbol/day).

# Progress

2026-10-07: implemented (decision 0020); 681 tests, typecheck, lint and web build pass.

# Validation

# Remaining Work
