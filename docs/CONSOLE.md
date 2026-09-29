# Authenticated read-only console

`https://trader.jjinsol.com` shows the logged-in owner's paper safety state, portfolio, loop runs,
orders and daily snapshots. `https://trader-api.jjinsol.com` is the API ingress. Containers still
bind to host loopback, behind the HTTPS ingress. No order, tick or configuration controls exist in UI.

## Login and ownership

Administrator-created email/password accounts only; no public signup or default password.
Passwords are 15–128 characters, salted scrypt hashes. Sessions expire after eight hours and are
revoked on logout, password reset, enable/disable or account binding changes. Account ownership is
unique and explicit. New users are unlinked by default and see an empty account-connect notice.
The current runtime supports one configured KIS paper account; adding users does not add brokers.
No historic orders are reassigned. An owner sees only records already scoped to that account.

From the repository on an administrator's computer (SSH access required):

```sh
python3 scripts/console-user.py create --bind-configured-account
```

Enter the owner email and password at the prompts. Password input is hidden and passed only over
SSH stdin, not command arguments/history. Do not paste it into chat or commit credential files.
Omit `--bind-configured-account` to create an unlinked user. Other administrative operations:

```sh
python3 scripts/console-user.py reset-password
python3 scripts/console-user.py disable
python3 scripts/console-user.py enable
python3 scripts/console-user.py unbind
python3 scripts/console-user.py bind
```

Binding refuses to take an account already owned by another user; first explicitly unbind its
current owner. Password reset preserves disabled status. There is no email reset service or MFA
in this version. The server CLI (`pnpm --filter server auth:user`, after build) accepts the same
strict JSON actions on stdin for other deployments. It never prints passwords or hashes.

## Boundaries and configuration

- Browser login/logout use same-origin `/api/auth/*`. Set web `CONSOLE_PUBLIC_ORIGIN` to its exact
  externally visible origin; POST requests without that Origin are rejected. Compose defaults to
  `https://trader.jjinsol.com`. For local dev use `http://localhost:3100` and pass environment to Next.
- The web server holds the individual session in a production `__Host-trader_session` cookie:
  Secure, HttpOnly, SameSite=Strict, Path=/, no Domain. Dev HTTP uses `trader_session`.
- Web `CONSOLE_API_URL=http://server:3000`; web has neither machine read nor order token.
  `/api/console/<name>` forwards only allow-listed GETs using the current session bearer.
- Backend `/api/v1/auth/{login,me,logout}` manages sessions; `/api/v1/me/console/*` verifies both
  the active session and current ownership on every request. Anonymous = 401, unlinked/other account = 403.
  No URL, query or browser header selects an execution account. Responses are no-store.
- Operator-only legacy `/api/v1/console/*` uses `CONSOLE_READ_TOKEN` (32+ chars, distinct from order
  token). Direct `/api/v1/portfolio`, `/api/v1/broker/status`, `/api/v1/market/:symbol/quote` and
  `/api/v1/risk/evaluate` now require a machine read or order token. Health remains public.
- User sessions cannot authorize order, strategy execution, tick or collection APIs.
- Login budgets are persisted atomically (5/email/15 min, 40/global/min), including wrong passwords
  and unknown emails. At most two scrypt checks run concurrently in one process. Rate-limited
  users wait 15 minutes; there is no automatic retry that could produce additional sessions.

## Reading the screen

Green PAPER means paper and live disabled. Amber unknown mode means unverified. Order-capable
switches are highlighted when on. Panel refresh failures keep last data with warning/time; auth
failures navigate away. Logout clears query cache and the next login loads a fresh document.
Times are Asia/Seoul, amounts KRW and quantities shares. Deposit cash is not buying power;
portfolio P/L is unrealized and differs from the execution ledger's realized P/L.

## Deployment and rollback

Back up DB and source/config first. Build `server` and `web`; explicitly apply migration 0006 with
`docker compose -p ai-trader-app run --rm --no-deps server node dist/infrastructure/database/migrate.js`,
then recreate both services. Migration only adds users, sessions and login-attempt tables; it does
not update financial rows or create an owner. Preserve trading flags and existing database volume.
Check `/` redirects to `/login`, unsigned web/API data reads are rejected, owner reads succeed,
unlinked users are denied, and logout invalidates replay. Provision the owner using the command above.

For rollback, stop public web/API ingress before reverting to a pre-auth build: that version exposes
anonymous data. Keep the additive auth tables for a forward fix; do not drop financial tables or
restore an old financial snapshot over new trades. Web build rollback alone is unsafe.

## Automatic trading switch

The `자동매매` card toggles owner pause/resume (see [decision 0010](decisions/0010-owner-auto-trading-control.md)).
Turning it off asks for one confirmation; turning it on asks for the password again. It only works
when the server environment allows automatic trading; otherwise the card shows `서버에서 막힘`.
Changes are listed under `변경 기록`. Pausing never cancels an order already sent.
