---
"aftermath-ts-sdk": minor
---

`Wallet.getAllBalances()` and `Wallet.getBalances()` now read through the gRPC
provider when one is available, so a wallet's SIP-58 address balance counts
towards its reported balance. The service endpoint they used before sums owned
`Coin<T>` objects only, which reported zero for accumulator-held funds. Wallets
constructed without an `AftermathApi` keep the previous behaviour.

Adds `Coin.getCoinsWithAmounts()`, wrapping `/coins/coins-with-amounts`: it
sources the requested amounts from owned coins and the address balance, appends
the coin-sourcing commands to a `TransactionKind`, and returns the extended kind
with one coin argument per requested amount.
