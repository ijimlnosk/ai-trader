# 0022 — Owner settings screen

Date: 2026-10-08. Status: accepted (scope agreed with the owner 2026-10-06/07; plan `exec-plans/active/settings-ui.md`).

- The console "설정" tab sets: momentum paper orders, virtual day trading, virtual ETF rotation and the take-profit watch
  on/off; the day-trading preset (`day-v1`, `day-quick` +3/−2, `day-patient` +8/−4 — virtual only, no backtest); the
  ETF preset (`etf-v1`, `etf-20-3`, `etf-20-2`, shown with the 2026-10-07 backtest); and Risk Engine limits.
- Risk limits are validated to be equal to or stricter than `DEFAULT_RISK_POLICY` (exposure ≤ 10%, ≤ 5 positions,
  daily loss ≤ 2%, ≤ 3 consecutive losses, confidence ≥ 0.70) and above small floors. Loosening needs a decision record
  and a code change. Live trading and kill-switch are not settings.
- Each save re-asks the password, is stored insert-only in `owner_settings` (migration 0016; the rows are the audit
  history with author and time) and applies from the next reviewed session. Server switches remain the outer bound.
- Consumers read today's effective settings: the momentum executor (with the auto-trading control), the virtual day
  trader (disabled = no new entries, exits continue), the ETF rotation (disabled = skip the week), the take-profit watch,
  and the order execution path, which evaluates risk with the owner policy (version `v1-owner` when changed) and stores
  it in the order audit; a failed settings read fails the order closed without a broker write.
- Also fixed: after a restart past 14:30 the virtual day trader now still manages exits (empty watchlist).
