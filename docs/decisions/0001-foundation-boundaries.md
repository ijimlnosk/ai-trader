# Foundation boundaries

Status: accepted for initial scaffold.

- The server rejects live broker mode even when both configuration flags opt in. The pure domain
  predicate represents necessary configuration only; no execution capability exists. This avoids
  silently returning a paper adapter when live mode was requested.
- PostgreSQL numeric(24,8) values remain strings and carry explicit currency. Future calculation
  code must choose exact decimal arithmetic and explicit rounding; schema objects are not entities.
- Compose requires an externally managed named volume. Existing DB ownership, project/network and
  mount configuration must be verified by the operator before using the supplied file. Automatic
  migration and automatic volume creation are intentionally absent.
- Runtime migrations use Drizzle ORM's compiled migrator. Drizzle Kit remains development-only.
