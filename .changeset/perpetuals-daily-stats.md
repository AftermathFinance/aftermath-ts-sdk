---
"aftermath-ts-sdk": minor
---

Add typed `Perpetuals.getCollateralFlows` and `Perpetuals.getMarketsDailyStats` clients for daily collateral flows and market statistics.

Use `stats/daily-collateral-flows` for collateral flows and `markets/daily-stats` for market statistics. Responses contain nested `stats` groups by collateral type or market ID, with timestamps and taker trade counts encoded as strings with a trailing `n`. Collateral flows support optional `collateralTypes` filters.

Include cumulative all-time fields up to and including each UTC day, independent of the requested time range: `cumulativeVolumeUsd`, `cumulativeTakerTrades` (parsed as `bigint`), and `cumulativeLiquidatedNotionalUsd` per market; `cumulativeDepositsUsd` and `cumulativeWithdrawalsUsd` per collateral type. Net deposits equal `cumulativeDepositsUsd - cumulativeWithdrawalsUsd`.
