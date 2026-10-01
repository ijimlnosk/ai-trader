# 0016 — Rebalance momentum rotation every session

Date: 2026-10-01. Status: accepted (owner request). Amends the cadence in 0013 and 0014.

Momentum entries and rank exits now run at every session close instead of only after the first
session of an ISO week. Trend exits and trims were already daily. `MomentumConfig.rebalanceCadence`
(`daily` | `weekly`, default `daily`) selects the cadence; `isRebalanceSession` is used by both the
live plan and the backtest, and the cadence is recorded in the plan configuration and order
`configId`. Strategy identity stays `momentum-rotation` v1.

Evidence on the 3-year, 54-symbol dataset (costs included):

| Engine | Weekly | Daily |
|---|---|---|
| Official backtest (return / MDD / fills) | +139.6% / 26.9% / 118 | +141.2% / 29.1% / 135 |
| Research simulator, full (return / MDD) | +80.2% / 28.2% | +100.2% / 22.3% |
| Research simulator, out-of-sample from 2025-10-01 | +33.3% / 27.8% | +39.3% / 26.1% |

The evidence does not show daily is clearly better; returns are comparable while turnover is about
15% higher. It was chosen to keep the five slots filled without waiting for the week to turn.
Risk limits, sizing (9% of equity), trim threshold (15%) and execution safeguards are unchanged.
