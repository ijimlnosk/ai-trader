TypeScript

Use strict TypeScript.

Avoid:

any

Prefer:

unknown

followed by validation or narrowing.

Do not use unsafe type assertions simply to silence TypeScript.

Functions

Prefer small functions with one responsibility.

Favor:

pure functions
explicit inputs
explicit outputs

Avoid hidden global state.

Files

Aim for roughly 100 lines when practical.

A file exceeding 100 lines is a review signal, not an automatic violation.

Split according to responsibility.

Do not split cohesive code only to reduce line count.

Naming

Use domain language.

Prefer:

evaluateRisk
createTradeProposal
calculatePositionSize

Avoid vague names:

processData
handleThing
utils
helper
manager

unless the term is genuinely accurate.

Booleans

Boolean names should communicate truth conditions.

Prefer:

isMarketOpen
canPlaceOrder
hasExceededDailyLoss
Units

Make financial units explicit.

Avoid ambiguous values such as:

price: number

when context is unclear.

Prefer types or naming that communicates:

KRW
USD
percentage
basis points
shares
milliseconds
Money

Never rely on floating-point arithmetic where exact monetary values matter.

Choose an explicit monetary representation.

Do not mix:

0.03
3
3%

for the same concept.

Comments

Comments explain:

why
constraints
non-obvious decisions

Do not narrate obvious code.

Errors

Use typed/domain-specific errors where useful.

Do not swallow errors.

Do not convert all failures to generic HTTP 500 without preserving context.

Never expose secrets through error messages.