---
"aftermath-ts-sdk": minor
---

Perpetuals TWAP order data (`getTwapOrderDatas` and the `twapOrders` WebSocket field) types the new optional error details and retry timing. `PerpetualsTwapOrderLastError` gains `failedLeg` (new `PerpetualsTwapOrderFailedLeg`, basket aborts only) and `attempt` (new `PerpetualsTwapOrderAttempt`, with bigint `requestedAmount` and `filledAmount`, plus `markPrice`, `limitPrice` and `bestOppositePrice`). `PerpetualsTwapOrderData` gains `nextRetryAtMs`, `retryAttempt` and `retryLimit`.
