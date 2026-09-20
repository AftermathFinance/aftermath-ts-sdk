---
"aftermath-ts-sdk": major
---

Remove dead builder-code integrator-vault methods and types.

`getCreateBuilderCodeIntegratorVaultTx`, `getClaimBuilderCodeIntegratorVaultFeesTx`,
and `getBuilderCodeIntegratorVaults` called API routes that no longer exist
(`create-integrator-vault`, `claim-integrator-vault-fees`, `integrator-vaults`).
Delete those methods and their request/response types. Update builder-code JSDoc
to the current registration / config / `builderCode` model (fee on filled notional
for taker and maker). Keep config create/remove/inspection helpers.
