---
"aftermath-ts-sdk": minor
---

Add `markPrice` and `bookPrice` to the perpetuals oracle websocket payload.

`markPrice` is the price positions are marked against for PnL and liquidation,
as opposed to the raw index. `bookPrice` is the raw orderbook mid and is `null`
when either side of the book is empty — mark falls back to the index price
upstream, whereas a raw mid has no meaningful fallback.
