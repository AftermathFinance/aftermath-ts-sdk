---
"aftermath-ts-sdk": minor
---

Replace the perpetuals rebates endpoints with `Rewards.getDistribution()`.

The backend removed `POST /api/perpetuals/rebates/rewards` and restored the
handler as `POST /api/rewards/distribution`, so the call moves from the
`Perpetuals` module to `Rewards`. The request and response shapes are
unchanged; only the path and the module differ.

**Removed** (their endpoints no longer exist, so they returned 404):

- `Perpetuals.getCurrentRebateRewards()` — use `Rewards.getDistribution()`
- `Perpetuals.getCsvRebates()`
- `Perpetuals.getReferralCsvRebates()`

Along with their types: `ApiPerpetualsCurrentRebateRewardsBody` / `Response`,
`ApiPerpetualsCreateCsvRebatesBody` / `Response`,
`ApiPerpetualsCreateReferralCsvRebatesBody` / `Response`,
`PerpetualsCalculationVariables`, `PerpetualsMakerData`,
`PerpetualsTakerData` and `PerpetualsRewardData`.

**Migration:**

```ts
// before
const data = await af.Perpetuals().getCurrentRebateRewards({ accountIds, ... });

// after
const data = await af.Rewards().getDistribution({ accountIds, ... });
```

The replacements are `ApiRewardsDistributionBody` / `ApiRewardsDistributionResponse`,
`RewardsDistributionCalculationVariables`, `RewardsDistributionMakerData`,
`RewardsDistributionTakerData` and `RewardsDistributionAccountData`.
