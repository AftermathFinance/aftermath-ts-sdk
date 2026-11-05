---
"aftermath-ts-sdk": minor
---

`GasPools.getPool` reads `/api/v1/gas-pool/pool`, and `ApiGasPoolResponse` gains `reserved`, the sponsorships handed out and not yet covered. `GasPools.spendableBalance(pool)` returns `balance - reserved`, floored at zero. New `GasPools.getHistory` pages a pool's balance movements, and `GasPools.getSwapFundedCreateTx` and `getSwapFundedDepositTx` build sponsored transactions that fund the pool by swapping a coin into SUI, so the wallet needs no SUI. A new `OneClickTrading` provider (`Aftermath.OneClickTrading()`) wraps `/api/v1/perpetuals/one-click-trading`: `getWallets`, `getGrantPreview`, `getRevokePreview`, `getGrantTx` (optionally sponsored through `swap`), and `getRevokeTx`.
