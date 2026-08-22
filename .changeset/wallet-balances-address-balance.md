---
"aftermath-ts-sdk": minor
---

`Wallet.getAllBalances()` and `Wallet.getBalances()` now read through the gRPC
provider, so a wallet's SIP-58 address balance counts towards its reported
balance. The service endpoints they used before (`all-coin-balances`,
`coin-balances`) sum owned `Coin<T>` objects only, so a wallet holding its funds
in the accumulator reported zero.

These reads now require an `AftermathApi` and throw without one, rather than
falling back to those endpoints and returning a quietly wrong balance. Only
`Aftermath.Wallet()` can produce a `Wallet`, and it always supplies a provider,
so no supported construction path is affected.

Adds `Coin.getCoinsWithAmounts()`, wrapping `/coins/coins-with-amounts`: it
sources the requested amounts from owned coins and the address balance, appends
the coin-sourcing commands to a `TransactionKind`, and returns the extended kind
with one coin argument per requested amount.
