# 0010 — Owner pause/resume of automatic paper trading from the console

Date: 2026-09-30. Status: accepted.

The owner wants to turn automatic paper trading on and off from the (internet-facing) console.
Until now user sessions could not affect trading at all; every switch lived in the server
environment and required a restart.

## Decision

- The environment stays the master switch. Automatic ticks run only when
  `PAPER_LOOP_SCHEDULE_ENABLED`, `PAPER_LOOP_ENABLED` and `PAPER_ORDER_EXECUTION_ENABLED` are all
  true **and** the owner's `trading_controls.auto_trading_enabled` is true (migration 0008).
  A missing row is paused. The web can narrow what the environment allows, never widen it.
- Only the session owner of the configured execution account may change it
  (`POST /api/v1/me/controls/auto-trading`, same session and ownership checks as console reads).
- Pausing needs one confirmation and no password: it can only reduce trading. Resuming requires
  the current password again (`reauthenticate`), sharing the per-email login budget.
- Every change is stored with user and time in append-only `trading_control_events`; the console
  shows the latest ten.
- Pausing stops new ticks only. A tracked order keeps being reconciled; nothing is cancelled.
  A paused morning is not consumed: resuming within 09:05–15:00 still ticks once that day.
  An unreadable control counts as paused.
- Live mode, kill switch, risk limits, execution and loop flags, orders and collection cannot be
  changed from the web. The request body is a strict `{ enabled, password? }`.

## Consequences

Deploying this makes automatic trading paused until the owner resumes it in the console, even if
the environment allows it. A leaked password could now resume paper trading (not live); the
step-up password check, rate limit and audit trail bound that risk.
