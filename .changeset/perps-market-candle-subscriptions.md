---
"aftermath-ts-sdk": minor
---

`Perpetuals.openUpdatesWebsocketStream` now exposes `subscribeMarketCandles` and `unsubscribeMarketCandles`, so market-candle streams can share the single updates socket instead of a dedicated connection.
