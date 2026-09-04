---
"aftermath-ts-sdk": major
---

Remove `Rewards.getExpectedRewards` and its types.

The backing `rewards/expected-rewards` endpoint has been removed from the API,
so the method could only fail. Callers previewing an epoch's rewards should use
`getDistribution` instead.

Removed alongside it: `ApiRewardsExpectedRewardsBody`,
`ApiRewardsExpectedRewardsResponse`, `RewardsExpectedCalculationVariables`,
`RewardsExpectedEpochInfo`, `RewardsExpectedTotals` and
`RewardsExpectedDomainTokens`.
