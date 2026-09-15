Architectural Style

Use clear application boundaries inspired by Clean Architecture.

Do not implement Clean Architecture ceremonially.

Introduce abstractions only where they protect a meaningful boundary.

Server Layers

Preferred dependency direction:

interfaces
    ↓
application
    ↓
domain

infrastructure
    ↓
application/domain
Domain

Contains:

entities
value objects
domain policies
domain calculations
domain errors

Must not depend on:

Fastify
Drizzle
PostgreSQL
Redis
OpenAI
HTTP clients
broker SDKs
Application

Contains:

use cases
orchestration
ports/interfaces
transaction boundaries

Application may depend on domain.

Application must not know concrete infrastructure implementations.

Infrastructure

Contains:

database repositories
broker adapters
AI adapters
market-data adapters
Redis
external APIs

Infrastructure implements application ports.

Interfaces

Contains:

HTTP handlers
route definitions
WebSocket interfaces
request/response mapping

Routes must not contain business logic.

Domain Boundaries

Initial domains:

market
strategy
analysis
risk
portfolio
trading
broker

Do not create a generic services/ dumping ground.

Business logic belongs to the owning domain.

Broker Port

Application code interacts with a broker port.

Example responsibility:

getQuote
getBalance
getPositions
placeOrder
cancelOrder

Concrete brokers are adapters.

Example:

KisBroker
PaperBroker

Do not leak broker-specific response formats into domain code.

AI Port

AI providers must be behind an abstraction.

Domain logic must not depend on:

OpenAI
Anthropic
specific model names
provider SDK types

AI output must be validated at the infrastructure/application boundary.

Frontend Boundary

Frontend must call backend APIs.

Never import:

apps/server/*

from:

apps/web/*

Shared contracts may be imported from:

packages/contracts
Deep Imports

Prefer public APIs.

Avoid:

@/features/foo/internal/a/b

Prefer:

@/features/foo

when the module exposes a public contract.

Circular Dependencies

Circular dependencies are architectural defects.

Do not resolve them with re-export tricks.

Fix ownership or dependency direction.