---
"aftermath-ts-sdk": minor
---

Perpetuals adds LWAP (liquidity-weighted average price) orders, which run on the TWAP order ticket with an executor that sizes each slice from orderbook depth. `PerpetualsAccount` gains `getCreateLwapOrdersTx`, `getCancelLwapOrdersTx`, `getLwapOrderDatas` and `getLwapOrderPreview` (account and vault routes), with the new `PerpetualsLwapOrderDetails`, `PerpetualsLwapOrderData`, `PerpetualsLwapOrderDetailsData`, `PerpetualsLwapPriceBand`, `PerpetualsLwapWaitReason` and `PerpetualsLwapWaitReasonCode` types. `PerpetualsLwapOrderData` reports execution gas with optional `gasDeposited`, `gasRemaining`, `gasPaid` and `gasReturned` (MIST). `PerpetualsWsUpdatesUserPayload` gains an optional `lwapOrders` field. `PerpetualsAccountOrderHistoryData` gains an optional `orderKind` (`PerpetualsTicketOrderKind`: `"twap"` or `"lwap"`) on TWAP order ticket lifecycle events, so order history can tell LWAP orders from TWAP ones.
