Prime Rule

No component may bypass the Risk Engine.

The only permitted order path is:

TradeProposal
→ RiskDecision
→ Execution
→ Broker
AI Authority

AI may:

analyze
summarize
score
explain
suggest
create a TradeProposal

AI may not:

place orders directly
modify risk limits
enable live trading
change kill switches
alter account credentials
bypass rejected trades
Trading Mode

Default:

paper

Live mode requires explicit configuration.

A missing value must resolve to paper or disabled.

Never default to live.

Live-Trading Guard

Live execution should require multiple deliberate conditions.

Conceptually:

BROKER_MODE=live

AND

LIVE_TRADING_ENABLED=true

AND

runtime safety validation passes

Do not reduce live activation to a single accidental toggle.

Kill Switch

The system must support stopping new orders independently of analysis.

Risk or operational failures should be able to halt execution.

Idempotency

Order submission must account for retries.

A network timeout must not automatically result in duplicate orders.

Use broker order IDs and/or idempotency mechanisms where available.

Risk Engine

Risk decisions must be deterministic.

Initial categories should support:

maximum position exposure
maximum portfolio exposure
maximum number of positions
daily loss limit
per-trade risk
maximum order size
confidence threshold where applicable
market-session validation
consecutive-loss halt
global kill switch
Rejections

Never modify input or risk limits simply to turn a rejection into approval.

Return the rejection reason.

Audit Trail

Persist enough information to reconstruct:

what happened
when
why
using what data
under what strategy
under what risk configuration
what order was submitted
what broker returned
Market Data

Never silently invent missing data.

Missing or stale market data should result in:

skip
hold
reject

rather than fabricated analysis.

Stale Data

Order decisions must verify data freshness.

A valid timestamp is part of trading correctness.

Backtesting

Never expose future information to the strategy.

At timestamp T, only information available at or before T may be used.

AI Failure

AI failure must not imply:

BUY
SELL

Safe fallback:

NO_TRADE
Broker Failure

Unknown broker state must not trigger blind retries.

Reconcile existing order state before retrying potentially duplicated orders.