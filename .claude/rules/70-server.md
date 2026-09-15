Backend Framework

Use Fastify as the HTTP interface.

Fastify is not the domain architecture.

Keep Fastify-specific code at the interface edge.

Routes

Routes should primarily:

validate request
call application use case
map result
return response

Do not place trading logic directly inside route handlers.

Validation

Validate all external input.

Includes:

HTTP
WebSocket
environment variables
broker responses
AI responses
market-data responses

Do not trust external systems merely because they are typed by an SDK.

Database

Use PostgreSQL with Drizzle.

Database schemas are infrastructure concerns.

Do not expose Drizzle models directly as domain entities or API contracts.

Use explicit mapping where boundaries matter.

Transactions

Use database transactions when multiple persistence operations must succeed atomically.

Trading audit records should not become partially inconsistent due to avoidable persistence ordering.

External APIs

External APIs require adapters.

Examples:

KIS
DART
news providers
AI providers
market-data providers

Keep provider-specific translation inside the adapter.

Time

Store timestamps consistently.

Prefer UTC internally.

Convert to market timezone explicitly where trading-session logic requires it.

For Korean markets, session logic must explicitly use:

Asia/Seoul

Do not rely on server-local timezone.

Jobs

Use background jobs only when necessary.

Examples:

market ingestion
scheduled strategy runs
daily portfolio snapshots
post-market review

Job handlers must be idempotent where retries are possible.

Logging

Use structured logs.

Include useful identifiers such as:

strategyRunId
proposalId
orderId
brokerOrderId
symbol

Never log:

API secrets
access tokens
account credentials
Order Execution

Execution should be isolated from strategy generation.

Recommended flow:

create proposal
→ evaluate risk
→ create execution request
→ broker adapter
→ persist broker response
→ reconcile state

Do not combine the entire process into one giant service.

Paper Broker

Paper trading should implement the same broker port used by live broker adapters.

This allows application code to remain unaware of trading mode.

Differences belong inside broker configuration and adapters.