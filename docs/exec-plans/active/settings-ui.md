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

- [ ] Wait for the small-account short-term research (determines which strategies and presets exist).
- [ ] Design: settings model, persistence and audit table, next-session activation, contract.
- [ ] Server: read/update endpoints behind session auth + password; validation against presets and ceilings.
- [ ] Web: settings screen with preset cards and backtest figures; change history.
- [ ] Tests (tightening-only rule, password, audit, next-session activation), deploy.

# Decisions

# Progress

2026-10-06: scope agreed with the owner.

# Validation

# Remaining Work

All steps.
