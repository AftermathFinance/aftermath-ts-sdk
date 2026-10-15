---
"aftermath-ts-sdk": minor
---

Add daily funding to `Perpetuals.getMarketsDailyStats` rows: `fundingRate` (mean hourly rate as a fraction), `fundingRateAnnualized` (`fundingRate × 8760`), `fundingSettlements` (parsed as `bigint`) and `fundingUsdPerUnit` (USD per base unit). Positive rates mean longs paid shorts. The API sends a `null` rate on days without settlements or a price, which the SDK returns as `undefined`. All four fields are optional while backends roll out. `openInterestUsd` now uses the last daily close on or before each day.
