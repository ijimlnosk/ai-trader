# 0019 — Archive OpenDART filings of universe symbols

Date: 2026-10-06. Status: accepted (owner request). Data only; no strategy or order uses it yet.

Momentum looks only at past prices. Filings such as rights offerings or major-shareholder sales are known
risks before they show in prices, so they are archived first to evaluate a "skip risky filings" filter.

- Source: OpenDART `list.json` over all filers, 100 per page (about 37 pages for 7–8 days, 2026-10-06).
  Status 013 is "no filings". Responses are validated; KRX codes may be alphanumeric (e.g. `0099X0`).
  Errors carry only the provider status or HTTP code, never the request URL that holds the key.
- Scope: the last 7 Seoul calendar days on every run (covers the longest closure run), filtered to universe
  stock codes, stored insert-only by receipt number in `dart_disclosures` (migration 0013).
- Schedule: `DISCLOSURE_SCHEDULE_ENABLED` (default false, requires `DART_API_KEY`). Once per session morning
  between 08:15 and 08:55 KST, before the 09:05 plan; up to three attempts, 10 minutes apart.
- Budget: persisted quota `opendart`, at most 300 calls/day and 6,000/month (provider limit 20,000/day).

A filter that blocks BUYs on filings needs its own evaluation and decision.
