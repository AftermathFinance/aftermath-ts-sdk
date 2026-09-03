---
"aftermath-ts-sdk": patch
---

Add `markPrice` to the perpetuals market websocket payload and correct the
oracle websocket `bookPrice` type to `number | undefined`.

The service sends JSON `null` when the raw orderbook midpoint is unavailable,
but the SDK JSON reviver converts that value to `undefined`. Market and oracle
streams expose the same position-marking quantity, sampled independently per
frame.
