---
"aftermath-ts-sdk": patch
---

Migrate the faucet package to the modernized on-chain `AftermathFaucet`. `requestCoinTx` now calls `mint` — which returns the minted `Coin<T>`, transferred to the requester by `buildRequestCoinTx` — and the `AddedCoin` event replaces `AddedCoinEvent`.

**Breaking:** `FaucetAddresses.objects` now requires the shared `config` object id.
