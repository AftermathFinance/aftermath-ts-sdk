---
"aftermath-ts-sdk": patch
---

Reverts `Router.addTransactionForCompleteTradeRoute()` to the v1 `serialize()`
wire format. Only the dynamic gas endpoint requires v2; the service behind
`transactions/add-trade` still reads v1, so that one has to move on both sides
at once.
