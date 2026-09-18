# Strategy Engine v1

The executable path is `daily OHLCV → screener → deterministic strategy → TradeProposal → Risk`.
Explicit paper submission continues through the existing Execution Engine and broker adapter.
Offline backtesting substitutes an isolated next-open simulation after Risk. No AI or scheduler runs.

## Exact rules

| Component | Definition |
| --- | --- |
| Universe | Caller-supplied six-digit symbols, unique and processed in lexical order |
| History | At least 61 complete daily bars; same declared sessions across all symbols |
| Price screen | Current close >= 1,000 KRW |
| Liquidity screen | Previous 20 bars' average close × volume >= 100,000,000 KRW; excludes current bar |
| EMA | 20 and 60; initial SMA followed by alpha = 2/(period+1) |
| RSI14 | Initial average gains/losses across 14 close changes, then Wilder smoothing; flat = 50, no losses = 100, no gains = 0 |
| ATR14 | Initial mean of 14 true ranges starting at the second bar, then Wilder smoothing; true range includes gaps to previous close |
| Volume ratio | Current volume / previous 20 bars' mean volume; zero denominator = null and cannot qualify |
| Trend | Up: EMA20 > EMA60 and close > EMA20; down: EMA20 < EMA60 and close < EMA20; otherwise mixed |
| Entry | No holding, passes screens, previous EMA20 <= EMA60, current EMA20 > EMA60, up trend, 50 <= RSI <= 70, volume ratio >= 1.2 |
| Exit | Existing holding and either EMA20 <= EMA60 or close < EMA60; sell entire holding, irrespective of price/liquidity screen |
| Size | Floor of min(1% equity / (2 × ATR), min(cash, 9% equity) / close); zero or unsupported size means no proposal |

Money uses exact 8-decimal BigInt arithmetic. Indicator arithmetic uses finite JS numbers; the ATR
risk-per-share estimate is rounded upward to an 8-decimal amount before exact sizing. An unsafe
numeric conversion means no proposal. No pyramiding, shorts, intraday stop orders or ATR stop-loss
execution is implemented. ATR is a sizing input; it does not guarantee a maximum realized loss.
Confidence `1` means the deterministic rules matched; it is not a predicted success probability.
These default thresholds are implementation starting points, not validated profitable parameters.

## Offline execution

From the repository root with pnpm 10.17.1 available:

```bash
pnpm --silent --filter server backtest --sample > /tmp/strategy-report.json
pnpm --silent --filter server backtest --file /absolute/path/daily-data.json ../../docs/fixtures/strategy-settings.json
pnpm --silent --filter server backtest --evaluate /absolute/path/daily-data.json ../../docs/fixtures/strategy-settings.json
```

The server script's working directory is `apps/server`; the paths above account for this.
`--sample` uses generated synthetic data, zero costs and the default strategy. Its weekdays are not an
actual KRX calendar. `--file` runs a complete backtest. `--evaluate` only evaluates the final bar with
an explicitly hypothetical flat account, initialCash equity/cash and zero realized history. It never
uses or substitutes for the real broker account, and cannot submit orders. Invalid input exits nonzero.
The compiled equivalent is `node apps/server/dist/app/backtest.js` with the same arguments.

All CLI outputs are JSON. A backtest report includes the entire input dataset/settings, all signal
and risk evaluations, simulated orders, net ledger, equity curve, open holdings, final unfilled
signals and summary. Retain the report and the repository commit for reproducibility. The sample
report's `input.data` is also a valid `--file` input.

Dataset shape (one bar shown only to explain the format; 61 are needed for signals):

```json
{
  "source": "your-archived-raw-daily-feed",
  "timezone": "Asia/Seoul",
  "priceBasis": "raw",
  "sessions": ["20260915"],
  "series": [{
    "symbol": "005930",
    "candles": [{
      "date": "20260915", "open": "70000", "high": "71000",
      "low": "69000", "close": "70500", "volume": "1000000"
    }]
  }]
}
```

Dates are strictly increasing KRX session dates YYYYMMDD; the data owner must supply the correct
expected calendar including holiday omissions. Every series must match that calendar exactly.
Duplicate/out-of-order bars, invalid OHLC, missing sessions, unknown fields, fractional/negative
volume, nonpositive prices, excess monetary precision and unsupported price bases are rejected.
A symbol with insufficient history is screened out; a dataset with unequal/missing history is rejected.
The file reader accepts up to 100 symbols and 10,000 bars per symbol. This simple replay recomputes
prefix indicators and ledger state; use small research datasets, not large-scale optimization.

Settings are a complete object, not a partial patch. See the checked-in example; its costs are
illustrative assumptions, not broker rates or current tax advice. Rates use integer basis points
(100 bps = 1%). Initial cash and amounts are KRW strings. Strategy thresholds can be varied offline;
the HTTP service uses the fixed default configuration and cannot accept a risk-policy override.

## Backtest timing and accounting

At each session open, pending proposals from the prior session are processed in symbol order. The
risk context values current positions at that open, never the day's close/high/low/volume. Buy price
is open plus slippage; sell price is open minus slippage. Both round adversely to 1e-8 KRW. Quantity
stays fixed even after a gap; the Risk Engine can reject it. Commissions apply on both sides, taxes
only on sales; each fee component rounds upward to 1e-8 KRW. Costs cannot exceed available cash.

The existing ledger projector runs on isolated net settlement amounts: BUY notional + commission
becomes acquisition cost; SELL notional − commission − tax becomes proceeds. This makes daily net
realized P/L and loss streak available to the next risk evaluation. Day boundaries use the declared
Seoul session date. Production KIS's gross ledger semantics are unchanged.

Summary totalReturn and maxDrawdown are ratios (0.01 = 1%), truncated to 8 decimal places. Maximum
drawdown uses closing equity with initial capital as the initial peak; it is not intraday drawdown.
Completed trades count full exits, winRate counts positive net exits and is null with no exits.
Realized P/L excludes unsold holdings; final equity includes them at final close. No final-bar fill,
terminal liquidation, automatic gap retry or partial fill is invented.

## Protected paper evaluation

`POST /api/v1/strategy/evaluate` uses the same bearer token and repository/service requirements as
orders. Body: `{ "data": <MarketDataset> }`. It returns configuration, data digest, per-symbol signal,
proposal, risk context/policy/decision, deterministic order key and `order: null`.

Only adding `"executeSymbol": "005930"` requests submission for that one symbol. It must have an
approved proposal. `PAPER_ORDER_EXECUTION_ENABLED=true` is still required by the existing execution
service; absent execution opt-in remains disabled. Fresh quote, session, holdings, ledger, buying
power, risk, durable reservation and unknown-outcome handling all remain in force. No actual broker
order is sent by the sample or tests. Existing GET/reconcile endpoints manage resulting orders.

Data must end at a completed close no older than four days. Submission additionally requires the
next calendar weekday after that close. Weekday holidays and special sessions are unsupported:
a Friday signal is eligible Monday, but not Tuesday even if Monday was a holiday. This restriction
fails closed until an authoritative exchange calendar is introduced. Execution uses the current
paper quote, not the simulated next-open price; historical data accuracy remains the caller's duty.

Strategy ID/version + symbol + completed bar determines a SHA-256-derived UUIDv8 idempotency key.
Changing side/settings/size cannot create a new identity for the same bar. Changed request data
under that key returns the existing conflict. An ambiguous submission is never retried. A later
portfolio change may result in no new signal or rejected context rather than replaying the response;
use the original returned order ID to inspect/reconcile it.

Existing JSONB request persistence stores selected-symbol candles, sizing account, indicator values,
source, strategy/config identity, reason and SHA-256 of the normalized complete request dataset.
That digest is computed over `JSON.stringify(parsedData)`, not original file whitespace. Preserve the
complete source dataset to verify the universe digest; the selected-symbol inputs are already stored
for signal reproduction. Pure evaluations/rejections before submission are returned as audits but
are not persisted in the order DB. Archive those responses if retaining all evaluations is required.

## Boundaries and known limitations

Historical KIS ingestion is not implemented: supply archived daily JSON. No current quote is turned
into a fabricated historical candle. There is no trusted exchange-calendar feed, automatic symbol
universe discovery, delisting history or corporate-action processing. Only raw prices are accepted;
exclude split/dividend-affected windows or provide a separately correct data pipeline in a later phase.
A static current universe creates survivorship bias when used historically.

Simulation assumes complete next-open liquidity and ignores spreads beyond configured slippage,
price limits, suspensions, queues, tick-size rounding, market impact and partial fills. It cannot infer
those facts from OHLCV. Sample returns are software fixtures, not evidence of strategy profitability.
No live trading, AI, UI, scheduler, optimizer or generic plug-in strategy framework was added.
