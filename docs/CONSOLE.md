# Read-only operator console

`apps/web` shows paper safety state, portfolio, paper-loop runs, orders and daily snapshots. It has
no order, tick, collection or configuration control.

## Access

The console and API bind to loopback on the host (`127.0.0.1:3201` console, `127.0.0.1:3200` API).
Use an SSH tunnel and open `http://localhost:3201/`:

```sh
ssh -N -L 3201:127.0.0.1:3201 sol-server
```

Do not publish either port. There is no login in v1; the tunnel is the access boundary.

## Tokens

- `CONSOLE_READ_TOKEN` (32+ characters, must differ from `ORDER_API_TOKEN`) authorizes only
  `GET /api/v1/console/{status,orders,loop-runs,snapshots}`. It cannot place orders, tick or collect.
- The `web` container receives `CONSOLE_READ_TOKEN` and `CONSOLE_API_URL=http://server:3000`; it
  never receives `ORDER_API_TOKEN`. The browser calls same-origin `/api/console/<name>`; the
  Next.js server forwards an allow-list of GET routes and only the `limit` parameter.
- Rotate by replacing the value in the server `.env` and recreating both `server` and `web`.

## Reading the screen

- Green `PAPER 모의투자` banner: paper mode and live disabled. Red `LIVE` means live mode or the live
  opt-in is set. Amber `모드 확인 불가` means status could not be read; treat it as unverified.
- Order-capable switches (paper execution, loop, automatic tick) are highlighted when ON.
- A panel whose refresh fails keeps its last data with a warning and its last update time.
- Times are Asia/Seoul; amounts KRW; quantities shares. Deposit cash is not buying power; portfolio
  profit/loss is unrealized and differs from ledger realized P/L.

## Deployment

The `web` service builds from `apps/web/Dockerfile` (Next.js standalone). Deploy with
`docker compose -p <project> build web` and `up -d --no-deps web` after the server exposes the
console endpoints. Rollback: stop `web`; the API endpoints stay token-protected and read-only.
