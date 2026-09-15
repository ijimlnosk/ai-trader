Testing Philosophy

Tests protect behavior and financial safety.

Prioritize tests around:

risk decisions
position sizing
order execution
portfolio calculations
strategy signals
market-session logic
external adapter mapping
Domain Tests

Domain logic should usually be testable without:

network
database
Fastify
broker
AI

Prefer deterministic tests.

Risk Engine

Every risk rule requires tests for:

allowed boundary
rejected boundary
exact limit
above limit
below limit
invalid input

Risk-engine tests are mandatory for risk changes.

Broker Tests

Never send real orders from automated tests.

Broker integration tests must use:

mock
stub
sandbox
paper environment
AI Tests

Do not test whether an LLM produces one exact sentence.

Test:

schema validation
parsing
fallbacks
malformed outputs
unavailable provider
timeout behavior
Regression Tests

When fixing a bug:

reproduce the behavior
add a failing regression test when practical
implement the fix
confirm the regression test passes
Backtest Tests

Backtests must guard against:

look-ahead bias
future leakage
incorrect candle ordering
timezone errors
duplicate candles
survivorship assumptions where applicable
Test Independence

Tests must not depend on execution order.

Avoid shared mutable state.