---
"aftermath-ts-sdk": minor
---

Perpetuals adds LWAP (liquidity-weighted average price) orders, which run on the TWAP order ticket with an executor that sizes each slice from orderbook depth. `PerpetualsAccount` gains `getCreateLwapOrdersTx`, `getCancelLwapOrdersTx`, `getLwapOrderDatas` and `getLwapOrderPreview` (account and vault routes), with the new `PerpetualsLwapOrderDetails`, `PerpetualsLwapOrderData`, `PerpetualsLwapOrderDetailsData`, `PerpetualsLwapPriceBand`, `PerpetualsLwapWaitReason` and `PerpetualsLwapWaitReasonCode` types. `PerpetualsWsUpdatesUserPayload` gains an optional `lwapOrders` field.
