---
"aftermath-ts-sdk": patch
---

feat(perpetuals): add TWAP price-condition and diagnostic types

Extend `PerpetualsTwapOrderDetails` with optional create-time `priceConditions`
(`triggerMarkPrice` / `stopMarkPrice` as `bigint`), and `PerpetualsTwapOrderData`
with optional `orderCreationTimestampMs`, normalized `priceConditions`, and
`lastError` for TWAP order responses from the perpetuals HTTP API.
