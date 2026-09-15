# 0002 — Paper portfolio valuation semantics

## Decision
The portfolio is a read-only view of KIS domestic balances. Cash means deposit total, not buying
power or withdrawable balance. Total evaluation uses the provider's total account evaluation;
P/L and purchase cost describe held securities, not cumulative realized trading performance.

The balance summary has no matching total holdings P/L-rate field in the official mapping.
Compute valuation P/L / purchase cost × 100 with BigInt decimal arithmetic and round half away
from zero to two decimal places. Preserve provider numeric strings for all other fields.
Zero cost and zero P/L displays 0.00; zero cost with nonzero P/L returns an invalid-response error.

## Consequences
No floating-point money arithmetic or decimal dependency is introduced. Consumers must not
interpret cash as an amount available for an order or interpret the rate as historical performance.
Zero-quantity historical holdings are omitted. A missing account summary is not an empty portfolio.
Repeated page totals are used once; inconsistent/incomplete pagination is rejected. Account-wide
summary consistency checks do not guarantee an atomic multi-page provider snapshot.

## References
- [KIS balance request](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_balance/inquire_balance.py)
- [KIS balance columns](https://github.com/koreainvestment/open-trading-api/blob/main/examples_llm/domestic_stock/inquire_balance/chk_inquire_balance.py)
