Frontend Architecture

Use Next.js App Router.

The app layer handles routing and composition.

Business behavior should not accumulate inside route files.

Suggested Layers

Within apps/web/src:

app/
views/
features/
entities/
shared/

Use FSD-inspired ownership.

Do not force every file into unnecessary layers.

Dependency Direction

Prefer:

app
 ↓
views
 ↓
features
 ↓
entities
 ↓
shared

Higher layers may depend on lower layers.

Lower layers must not depend on higher layers.

Server State

Use TanStack Query for remote/server state.

Examples:

quotes
portfolio
positions
orders
trade proposals
analysis

Do not duplicate server-state ownership in Zustand.

Zustand

Use Zustand only for genuine client state.

Examples:

UI preferences
local filters
temporary panel state

Do not use it as a replacement for server cache.

Components

Keep business logic out of presentational components.

Extract:

hooks
models
query definitions
domain formatting

when responsibility becomes mixed.

API

Frontend communicates through backend APIs.

No broker credentials or AI provider secrets may exist in browser code.

Never call a brokerage order API directly from the browser.

Contracts

Use:

packages/contracts

for shared API contracts.

Validate external data at boundaries.

Financial UI

Clearly distinguish:

paper
live

trading modes.

Never make live mode visually ambiguous.

Important order actions should expose:

symbol
side
quantity
expected price
trading mode