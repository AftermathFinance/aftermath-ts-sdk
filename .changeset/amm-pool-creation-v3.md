---
"aftermath-ts-sdk": minor
---

Migrate pool creation to the v3 AMM package. `createPoolTx` now targets `create_pool_N_coins_v2` with the v3 argument shape (no LP metadata or forced LP decimals), and `getPublishLpCoinTransaction` is server-backed so the LP coin package is templated with the pool's metadata, weights, decimals, and flatness and mints a `CreatePoolCapV2`.

Breaking: `ApiPublishLpCoinBody` now carries the LP metadata and pool config; `ApiCreatePoolBody` drops `lpCoinMetadata` and `forceLpDecimals`. The client-side `publishLpCoinTx` / `buildPublishLpCoinTx` builders and the `PoolsAddresses.other.createLpCoinPackageCompilations` config field are removed.
