# Goal

Move from one symbol (`005930`) to autonomous paper trading across a reviewed universe: scan every
listed candidate daily, buy the strongest deterministic signals, sell holdings whose signals turn,
and add a news/disclosure analysis layer that can only make trading more conservative.

# Constraints

- Paper only. Risk engine stays authoritative and unchanged in this plan: at most 5 open positions,
  10% position exposure, 2% daily loss, 3-loss halt, kill switch. AI never sizes, forces or
  approves a trade; AI failure means no new BUY (NO_TRADE), never a forced SELL.
- One unresolved order per account remains (existing reservation). Orders in one tick run
  sequentially: submit, reconcile to a terminal state, then the next.
- Only information available at decision time; archived inputs for every decision (bars,
  news items with timestamps, AI prompts/outputs, risk context). No look-ahead in backtests.
- Owner web pause (decision 0010) and environment master switches apply to everything.

# Current State (verified 2026-09-30)

- Once per reviewed session at 09:05–15:00 KST the loop evaluates `005930` only, from a snapshot
  re-confirmed that morning; tracking polls every 30 s while an order is open. 9/30: `NO_ENTRY`.
- KIS paper keys: daily bars for any symbol work (`FHKST03010100`, e.g. 000660). Volume/price
  ranking (`FHPST01710000`) and news titles (`FHKST01011800`) return `provider_unavailable`, so
  market-wide ranking and news cannot come from the paper KIS account.
- Paced KIS client: 1.5 s minimum between requests (≈ 75 s for 50 symbols per collection).
- Strategy/risk/backtest already accept multi-series datasets; loop, preparer and collector are
  hard-wired to `005930`; loop claims assume one symbol per session.

# Plan

Phase C1 — universe and data (order-free)
- [x] Reviewed universe file (versioned, sourced), initially ~50 liquid KOSPI/KOSDAQ names (54, decision 0011).
- [x] Collect/confirm daily snapshots for every universe symbol (holdings outside the universe: pending); one
      calendar-aligned dataset per session; partial failures skip only that symbol and are shown.
- [ ] Console: universe coverage and data freshness.

Phase C2 — multi-symbol decisions (paper)
- [x] Per-session plan: evaluate all symbols; SELL candidates for held symbols first, then BUY
      candidates ranked by a deterministic score; each through the unchanged risk engine
      (order-free `plan-*` strategy runs, `UNIVERSE_PLAN_SCHEDULE_ENABLED`, sequential risk context).
- [ ] Loop run per (session, symbol) with the existing order-key/claim guarantees; sequential
      execution; stop the session on any HALTED/unknown state.
- [x] Backtest the universe strategy (next-open fills, costs) before enabling; record results.
      Result 2026-09-30: −2.5% vs +29.6% equal-weight buy-and-hold; execution blocked pending strategy
      research and an owner decision on the consecutive-loss halt reset ([report](../../BACKTEST_UNIVERSE_2026-09-30.md)).
- [x] Console: today's plan (scanned, signals, approved, skipped with reasons). Orders pending C2 execution.

Phase C3 — news and disclosures (analysis only)
- [x] Naver news search adapter with persisted hard call budget and daily archive (DART pending). Keys
      supplied by the owner in the server `.env`; none in chat or the repository.
- [ ] AI provider abstraction (Claude) producing a validated structured assessment per symbol
      (event flags, sentiment, confidence, cited items). Timeouts and malformed output → no
      assessment → no new BUY for that symbol.
- [ ] Policy: assessments may veto or down-rank BUYs and flag held symbols for review; they may
      not create orders or change risk limits. Archive every prompt/output with the run.
- [ ] Offline evaluation on archived history before it affects paper orders.

# Decisions pending (owner)

- Universe: size and membership (recommend ~50 by liquidity, reviewed monthly).
- External keys: DART, news API, Anthropic — owner registers and places them in server `.env`.
- Whether AI may ever up-rank (not only veto) — recommend veto-only initially.

# Validation

Unit tests per phase; disposable-DB tests; order-free deployment of C1 and a dry-run week of C2
plans before enabling orders; evidence documents per enablement.

Phase C2b — strategy
- [x] Walk-forward research; momentum rotation selected (decision 0013); corporate-action guard.
- [x] Consecutive-loss cooldown (decision 0012).
- [x] Momentum rotation implemented with trims; official backtest; daily `plan-momentum-*` runs next to EMA plans.
- [ ] Two weeks of order-free momentum plans reviewed; then an owner-approved change to allow
      momentum provenance and sequential multi-order execution.

# Progress

2026-09-30: plan drafted; KIS paper capability probe recorded above.
2026-09-30: universe (54), universe collection, Naver news archive with hard budget and console news tab implemented.
2026-09-30: order-free universe plan (dataset builder with confirmed/aligned symbols only, sequential risk planning,
  09:05 schedule step, console card). Plan items are not executed; the live loop still trades 005930 only.
  Before execution: a validation week of plans, a universe backtest, and holdings outside the universe.

# Remaining Work

All steps.
