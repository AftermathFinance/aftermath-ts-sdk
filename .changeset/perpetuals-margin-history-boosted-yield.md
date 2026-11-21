---
"aftermath-ts-sdk": minor
---

Perpetuals account margin history (`getMarginHistory`) types the new optional `boostedYieldUsd` on `PerpetualsAccountMarginHistoryData`: the cumulative USD value of the boosted yield paid into a vault's account. It is `undefined` for an account that is not a vault's account, when the data is unavailable, and on API deployments that predate it.
