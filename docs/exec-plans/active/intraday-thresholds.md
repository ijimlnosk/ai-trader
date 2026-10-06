# Goal

Owner request (2026-10-06): react during the session instead of only at 09:05.

- Take profit: sell (all or part) of a held position once it has risen by a set threshold.
- Stop loss: sell a held position once it has fallen by a set threshold.
- Buy the dip: buy once a symbol has fallen by a set threshold, when the numbers say it is acceptable.

Research first. Nothing here changes orders until a backtest supports it and the owner approves.

# Constraints

- Every order still goes TradeProposal → Risk Engine → Execution → Broker; paper only.
- Thresholds are fixed configuration chosen by research, never by AI and never loosened to force a trade.
- Intraday decisions need fresh quotes (the execution path already rejects quotes older than 10 s).
  Missing or stale data means no action.
- Intraday rules must not fight momentum: momentum buys strength and keeps winners, so a fixed take-profit
  can cut the trades that produce most of its return (2026-09-30 research), and buying dips is the
  opposite signal. A dip-buy rule is therefore a separate strategy with its own budget and limits.
- KIS call budget: polling 54 symbols during the session adds quote calls on top of collection.
- Backtests use only data available at each minute (no look-ahead), with costs and slippage.

# Current State

- Momentum trades once per session at 09:05 on the previous close. Sells: trend exit (close ≤ 120-day MA),
  rank exit (rank ≥ 10), trim (position > 15% of equity, back to 9%). No intraday exit or entry.
- Daily loss limit and kill switch block new BUYs only; they never sell.
- Minute bars are archived after each close since 2026-10-01 (decision 0017). KIS serves only the current
  day's minute bars, so the research set grows by one session per day (2 sessions as of 2026-10-06).

# Plan

- [ ] R1. Accumulate minute bars; check completeness per symbol and session (no fabricated gaps).
- [ ] R2. Minute-level backtest of stop loss and take profit (full and partial) on momentum holdings,
      against momentum alone. Needs enough sessions; daily-bar proxies (high/low touches) can give an
      early, clearly labeled estimate before then.
- [ ] R3. Separate study of a buy-the-dip strategy: entry rule, universe filter, exit, position limits.
- [ ] R4. Owner review of results; decision record for any rule adopted.
- [ ] I1. Intraday monitor: polls quotes for held/candidate symbols in session hours, emits proposals only.
- [ ] I2. Order-free dry run (proposals logged, not sent) for at least one week; then a bounded enabled session.

# Decisions pending (owner)

- Threshold values (decided by R2/R3, not in advance).
- Take profit: full sale or partial; whether it applies on top of trim.
- Dip buying: only momentum candidates, or a separate list; budget share of equity.

# Decisions

# Progress

2026-10-06: plan created from the owner request.
2026-10-06: R2/R3 daily-bar proxy done ([research](../../INTRADAY_THRESHOLDS_RESEARCH_2026-10-06.md)). Candidate:
  take profit 30% (full) with a 5-session re-entry block; stop loss alone and dip buying not supported.
  Minute-bar confirmation (R1/R2) still required before I1.

# Validation

Backtest reports with in-sample/out-of-sample split; dry-run logs; risk tests for any new rule.

# Remaining Work

All steps.
