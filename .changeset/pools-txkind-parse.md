---
"aftermath-ts-sdk": patch
---

Fix pool creation transaction parsing. `getPublishLpCoinTransaction` and `getCreatePoolTransaction` now consume the server's `{ txKind }` response via `fetchApiTxObject` (`Transaction.fromKind`, or `Transaction.from` when sponsored), fixing "First argument to DataView constructor must be an ArrayBuffer".
