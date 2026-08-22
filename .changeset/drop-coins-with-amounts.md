---
"aftermath-ts-sdk": patch
---

Removes `Coin.getCoinsWithAmounts()` and its `CoinsWithAmountsGasData` /
`CoinsWithAmountsGasCoin` types. It wrapped the service's
`/coins/coins-with-amounts` endpoint, which no caller adopted; treating it as
withdrawn now rather than leaving an unused transaction-building surface in the
public API. Everything else added in 3.3.0 is unaffected.
