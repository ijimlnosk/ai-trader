# 0012 — Consecutive-loss halt expires after five sessions

Date: 2026-09-30. Status: accepted (owner decision, option "b").

The universe backtest showed the three-loss halt becoming permanent: the streak only reset on a
winning sale, which cannot happen while every BUY is rejected. The live account used the same rule.

Decision: the streak (still `maxConsecutiveLosses = 3`) expires once five trading sessions have
passed after its latest losing sale (`CONSECUTIVE_LOSS_COOLDOWN_SESSIONS`). A win still resets it
immediately. After expiry a new loss starts a fresh streak at one. Sessions are counted strictly
after the loss date up to and including the evaluation day: live accounts use the reviewed KRX
calendar (`krxSessionsElapsed`); backtests use the dataset's own sessions. If the calendar cannot
count the days (outside coverage), the streak does not expire. Other risk limits are unchanged,
and the halt still applies to BUYs only (SELLs remain allowed).
