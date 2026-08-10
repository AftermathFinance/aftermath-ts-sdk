---
"aftermath-ts-sdk": patch
---

TWAP orders are now supported for vault accounts: `getCreateTwapOrdersTx`, `getEditTwapOrdersTx`, and `getCancelTwapOrdersTx` route to the vault endpoints instead of throwing, and their request bodies accept either `accountId` or `vaultId`. The user updates websocket payload also includes `twapOrders` alongside `stopOrders`.
