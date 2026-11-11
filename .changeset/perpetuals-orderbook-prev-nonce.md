---
"aftermath-ts-sdk": minor
---

Perpetuals orderbook deltas (`PerpetualsOrderbookDeltas`, the `orderbook` WebSocket update) type the new optional bigint `prevNonce`: the `nonce` of the previous delta sent for that market on the same connection. A delta whose `prevNonce` differs from the `nonce` of the delta applied before it means an update was missed and the local book must be resynced; skip the check on the first delta after a snapshot or a new subscription. `nonce` is now documented as increasing without a fixed step, so do not assume it increases by 1. Servers that predate the field leave `prevNonce` undefined.
