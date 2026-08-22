---
"aftermath-ts-sdk": patch
---

`Wallet.getBalances()` and `Wallet.getAllBalances()` call the `coin-balances`
and `all-coin-balances` service endpoints again, as they always did. Routing
them to the gRPC provider was the wrong layer: it gave the SDK a second source
of truth for balances and papered over the service endpoints under-reporting
SIP-58 address balances, which is fixed service side instead.
