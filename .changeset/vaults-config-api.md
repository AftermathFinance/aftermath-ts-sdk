---
"aftermath-ts-sdk": major
---

Add `Perpetuals.getVaultsConfig()` for fetching current on-chain vault protocol
limits and remove the obsolete hardcoded `PerpetualsVault.constants` values.
Integer fields are returned as `bigint`, matching the service's lossless
`"123n"` wire format.
