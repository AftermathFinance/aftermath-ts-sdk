---
"aftermath-ts-sdk": patch
---

Point pool creation at the versioned `pools/v1/transactions/*` endpoints. `getPublishLpCoinTransaction` and `getCreatePoolTransaction` now call the v1 paths, which build against the v3 AMM contract, while the unversioned endpoints stay on the current live functions so existing integrations keep working.
