---
"aftermath-ts-sdk": patch
---

`DynamicGas.getUseDynamicGasForTx()` and
`Router.addTransactionForCompleteTradeRoute()` now send transactions as v2 JSON
(`toJSON()`) rather than the deprecated v1 `blockData` shape (`serialize()`),
which the services reject as invalid input.
