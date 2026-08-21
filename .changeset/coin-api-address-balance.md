---
"aftermath-ts-sdk": minor
---

`fetchCoinWithAmountTx` / `fetchCoinsWithAmountTx` now source coins via the
`CoinWithBalance` intent, making them SIP-58 address-balance aware: wallets
whose funds live in the address-balance accumulator (previously "wallet does
not have coins of sufficient balance") can now build transactions, and coin
pagination is skipped entirely on this path. Sponsored transactions keep the
owned-coin selector, since the sponsor's V1 gas-rewrite cannot encode the
intent's FundsWithdrawal input. An up-front total-balance check preserves the
canonical insufficient-balance error.
