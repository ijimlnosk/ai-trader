# Goal

Owner request (2026-10-06): choose strategies and settings in the console instead of server configuration.

# Constraints (agreed with the owner 2026-10-06)

- Choices, not free numbers: the active strategy (momentum / short-term if research supports it / off) and
  presets of parameters that a recorded backtest covers, shown with that backtest's return and drawdown.
- Record-only features (take-profit watch, AI screening, DART archive) may be toggled.
- Never in the UI: live trading (stays a multi-condition server configuration) and loosening risk limits.
  Risk limits may only be tightened in the UI; loosening needs a decision record and a separate change.
- Every change re-asks the owner's password (as auto-trading resume does) and is audited: who, when, what,
  previous and new value.
- Changes take effect from the next session, never mid-session.
- Environment switches remain the outer bound: the UI can narrow what the server allows, never widen it.

# Current State

Only auto-trading pause/resume exists in the UI (`trading_controls`, password on resume).

# Plan

- [x] Wait for the small-account short-term research (determines which strategies and presets exist).
- [x] Design: settings model, persistence and audit table, next-session activation, contract.
- [x] Server: read/update endpoints behind session auth + password; validation against presets and ceilings.
- [x] Web: settings screen with preset cards and backtest figures; change history.
- [ ] Tests (tightening-only rule, password, audit, next-session activation), deploy.

# Decisions

2026-10-08 design:
- Settings: on/off for momentum paper orders, virtual day trading, virtual ETF rotation and the take-profit watch;
  a day-trading preset (virtual only, judged by its virtual record — no backtest exists for intraday exits) and an
  ETF preset (shown with the 2026-10-07 backtest figures); risk limits that may only be equal to or stricter than
  `DEFAULT_RISK_POLICY`.
- Storage: insert-only `owner_settings` rows with `effective_from` = next reviewed session; the effective settings are
  the newest row whose `effective_from` is on or before today, else the defaults. The rows are the audit history.
- Consumers read the effective settings each step. Disabling a virtual strategy stops new entries; exits continue.
  The execution path evaluates risk with the effective (tightened) policy and stores it in the order audit.
- Virtual ledgers keep their ids (`day-v1`, `etf-v1`) across presets.

# Progress

2026-10-06: scope agreed with the owner.
2026-10-08: implemented (decision 0022); 711 tests, typecheck, lint pass. Not inspected in a browser before deploy.

# Validation

# Remaining Work

All steps.
