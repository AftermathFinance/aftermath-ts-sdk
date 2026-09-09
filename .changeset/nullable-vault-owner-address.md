---
"aftermath-ts-sdk": patch
---

fix(perpetuals): type vault `ownerAddress` as nullable

The `/perpetuals/vaults` endpoint now returns `ownerAddress: null` when a vault's owner cap (or its owner address) cannot be resolved. `PerpetualsVaultObject.ownerAddress` is now `SuiAddress | null` to match, and `PerpetualsVault.partialVaultCap()` falls back to the empty-address sentinel so ownership checks treat an unresolved owner as "not owner".
