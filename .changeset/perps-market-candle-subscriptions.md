---
"aftermath-ts-sdk": patch
---

`Perpetuals.openUpdatesWebsocketStream` now exposes `subscribeMarketCandles` and `unsubscribeMarketCandles`, so market-candle streams can share the single updates socket instead of a dedicated connection.
