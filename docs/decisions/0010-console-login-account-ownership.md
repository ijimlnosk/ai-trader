# 0010 — Console login and explicit account ownership

Status: accepted, 2026-09-29.

The publicly deployed web BFF previously injected a shared read token for anonymous visitors;
legacy portfolio/quote/risk reads were also unauthenticated. Page redirects alone cannot fix this.

Use administrator-created email/password users, database-backed revocable opaque sessions, and a
nullable unique execution-account binding. Runtime currently has one KIS paper account; authorize
user data routes only when the authenticated user's current binding equals that runtime account.
Repository filtering remains mandatory. Unlinked users get no broker or console access. Neither
client account IDs nor a session permit broker execution. Historical financial records remain intact.

Store only SHA-256 of random 256-bit session tokens; absolute expiry eight hours. Passwords use
asynchronous scrypt N=2^17, r=8, p=1, random 128-bit salt, 512-bit output, per
[OWASP Password Storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Bound concurrent hashing and persist global/per-email login budgets, with equivalent verification
for unknown users. Login revalidates credentials under the same user-row lock used for administrative
revocation, preventing a password-reset race from issuing an old-credential session afterward.

The Next BFF stores a host-only Secure/HttpOnly/SameSite=Strict cookie and forwards individual
sessions. It receives no machine tokens. Same-origin POST checks prevent login/logout CSRF.
All auth/data responses are no-store; logout clears query state and performs a document navigation.
Machine read/order tokens remain a distinct administrative boundary. Direct account, quote, broker
status and risk-evaluation endpoints require machine authentication; health remains public.

Migration 0006 is additive. No signup, password-email service, MFA or multi-broker credential storage
is introduced. Administrator operations occur via SSH stdin; account binding and all administrative
updates revoke existing sessions. Owner identity is explicitly supplied, never inferred from Git or
server accounts. Future multiple-account support must compose the matching broker/ledger per user,
not remove the equality guard around the current singleton broker.
