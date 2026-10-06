---
"aftermath-ts-sdk": minor
---

Add typed `Perpetuals.getCollateralFlows` and `Perpetuals.getMarketsDailyStats` clients for daily collateral flows and market statistics.

Use `stats/daily-collateral-flows` for collateral flows and `markets/daily-stats` for market statistics. Responses contain nested `stats` groups by collateral type or market ID, with timestamps and taker trade counts encoded as strings with a trailing `n`. Collateral flows support optional `collateralTypes` filters.
