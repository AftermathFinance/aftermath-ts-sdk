---
"aftermath-ts-sdk": minor
---

Restore `Perpetuals.getCsvRebates()` and `Perpetuals.getReferralCsvRebates()`.

These were removed alongside `getCurrentRebateRewards()` when the backend
dropped the rebates endpoints. Unlike that one, the CSV reports have no
replacement yet, so removing them left callers with nothing to migrate to.
They are back so existing code compiles, and they will start working again
once the backend ships replacement endpoints.

**They currently fail at runtime** — `/api/perpetuals/rebates/create-csv-rebates`
and `/api/perpetuals/rebates/create-referral-csv-rebates` no longer exist.

`ApiPerpetualsCreateCsvRebatesBody` now extends `ApiRewardsDistributionBody`
rather than the deleted `ApiPerpetualsCurrentRebateRewardsBody`. The shape is
unchanged — same reward pools, account filter and calculation variables, plus
`aggregated`.

`getCurrentRebateRewards()` stays removed: it has a working replacement in
`Rewards.getDistribution()`.
