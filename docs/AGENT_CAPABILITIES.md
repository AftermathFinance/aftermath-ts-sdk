# SDK capability and verification map

`Aftermath.create({ network, baseUrl, fullnodeUrl })` is the high-level entrypoint. It discovers addresses unless `addresses` or a prebuilt `api` is supplied. `AftermathApi` accepts a gRPC client and addresses; its optional JSON-RPC client is required by the remaining legacy event, transaction-cursor, and system-state calls. Read [provider layers](explanation/provider-layers.md) before changing transport ownership.

Most capabilities are reached through `Aftermath` accessors. The root `src/packages/index.ts` barrel exposes a smaller set of named classes; verify a named export in `src/index.ts` and the built declaration before documenting a direct import.

All default tests are offline. Use `bun run test:focused -- <path>` for a row below, then run the full gate in `AGENTS.md`. Captured gRPC/JSON-RPC objects live in `tests/fixtures/objects/`; do not recapture them from production during routine tests.

| Caller capability | Owner | Focused proof |
| --- | --- | --- |
| Auth and access tokens | `src/packages/auth/` | `tests/packages/auth/auth.test.ts` |
| Coin metadata, balances, pagination | `src/packages/coin/` | `tests/packages/coin/coin.test.ts` |
| DCA orders | `src/packages/dca/` | `tests/packages/dca/dca.test.ts` |
| Farm positions and rewards | `src/packages/farms/` | `tests/packages/farms/farms.test.ts` |
| Faucet reads and mint transactions | `src/packages/faucet/` | `tests/packages/faucet/faucet.test.ts` |
| Gas pool sponsorship | `src/packages/gasPools/` | `tests/packages/gasPools/gasPools.test.ts` |
| Limit orders | `src/packages/limitOrders/` | `tests/packages/limitOrders/limitOrders.test.ts` |
| Multisig | `src/packages/multisig/` | `tests/packages/multisig/multisig.test.ts` |
| NFT AMM markets | `src/packages/nftAmm/` | `tests/packages/nftAmm/nftAmm.test.ts` |
| Perpetuals markets, accounts, vaults | `src/packages/perpetuals/` | `tests/packages/perpetuals/api.test.ts`, `tests/packages/perpetuals/account.test.ts`, `tests/packages/perpetuals/market.test.ts`, `tests/packages/perpetuals/vault.test.ts`, `tests/packages/perpetuals/client.test.ts` |
| AMM pools and pool math | `src/packages/pools/` | `tests/packages/pools/pools.test.ts`, `tests/packages/pools/calculations.test.ts` |
| Referral vault compatibility | `src/packages/referralVault/` | `tests/packages/referralVault/referralVault.test.ts` |
| Referrals | `src/packages/referrals/` | `tests/packages/referrals/referrals.test.ts` |
| Rewards | `src/packages/rewards/` | `tests/packages/rewards/rewards.test.ts` |
| Router quotes and trades | `src/packages/router/` | `tests/packages/router/router.test.ts`, `tests/serializedTxFormat.test.ts` |
| afSUI staking | `src/packages/staking/` | `tests/packages/staking/staking.test.ts` |
| Sui chain data | `src/packages/sui/` | `tests/packages/sui/sui.test.ts` |
| SuiFrens | `src/packages/suiFrens/` | `tests/packages/suiFrens/suiFrens.test.ts` |
| User public-key and message flows | `src/packages/userData/` | `tests/packages/userData/userData.test.ts` |

| Shared/public surface | Owner | Proof and observable result |
| --- | --- | --- |
| Provider bootstrap and HTTP transport | `src/general/providers/`, `src/general/utils/caller.ts` | `tests/general/providers/aftermath.test.ts`, `tests/general/utils/caller.test.ts`; `bun run build && bun run verify:public` exercises the packaged entrypoint, address discovery, router response, and HTTP error classification. |
| Low-level Sui helpers, gRPC casters, optional JSON-RPC | `src/general/apiHelpers/`, `src/general/utils/grpcCasting.ts` | `tests/general/apiHelpers/`, `tests/cross-cutting/grpcMigration.test.ts`; `verify:public` checks construction and the missing JSON-RPC error. |
| Wallet, NFT, prices, dynamic gas | `src/general/wallet/`, `src/general/nfts/`, `src/general/prices/`, `src/general/dynamicGas/` | Matching tests under `tests/general/`; `test:surface:strict` checks every source area has executed modules. |
| Inactive price-feed placeholder | `src/general/priceFeeds/` | `tests/general/services/priceFeeds.test.ts` confirms it has no callable feed API. Do not promise a feed method. |
| Perpetuals WebSocket updates and candles | `src/packages/perpetuals/perpetuals.ts`, `src/general/utils/caller.ts` | `tests/packages/perpetuals/websocket.test.ts`, `tests/general/utils/caller.test.ts`; check URL, subscription payload, parsed message, and close behavior. |
| Transaction wire formats and cancellation | `src/general/utils/caller.ts`, package builders | `tests/serializedTxFormat.test.ts`, `tests/cross-cutting/abortSignalPropagation.test.ts`; inspect serialized values and caller-owned signal propagation. |
| Published npm artifact | `package.json`, `tsup.config.ts`, `src/index.ts` | `bun run build`, `bun run verify:public`, `bun run package:check`; verifier imports the built ESM package, checks every `Aftermath` provider accessor and key named exports, and compiles a consumer against the built declaration. Package check enforces intended tarball files. In restricted sandboxes, direct `npm pack --dry-run --ignore-scripts --json` may work when Node child-process spawning does not. |
| Authored and generated docs | `README.md`, `docs/`, `typedoc.json` | `bun run docs:audit:strict`, `bun run docs:generate`, `bun run docs:check-links`, `bun run docs:check-site`; [documentation guide](DOCUMENTATION_GUIDE.md) defines public scope. |
| Release safety | `scripts/release.mjs`, `.github/workflows/release.yml` | `bun run test:release` checks exact-version and retry behavior without publishing. The read-only `verify` job runs the full gate before either credential-bearing publish job. Never run `bun run release` as a verification step. |

Copy the boundary style from `tests/general/providers/aftermath.test.ts`, the wire-format assertions from `tests/serializedTxFormat.test.ts`, and the literal math expectations from `tests/packages/pools/calculations.test.ts`. `tests/legacy/` is historical evidence, not a new-test template.

## Regression tasks for agent evaluations

These are small replay cases from repository history. Start each from a clean checkout and judge the diff and matching proof, not the agent's self-report. No automated agent runner is configured here.

| Request to replay | Independent acceptance |
| --- | --- |
| Update one router transaction endpoint to a new serialized format without changing endpoints that still use v1 (the broad migration was reverted in `681f48b`). | `tests/serializedTxFormat.test.ts` passes; inspect the exact wire payload of each affected endpoint. |
| Change generated documentation while keeping maintainer-only pages out of the public site (the previous site exposed them). | Strict docs audit, TypeDoc generation, link check, site scope check, and npm package check pass. |
| Add or change a high-level provider method without breaking the distributed SDK (historical package checks failed in CI). | Build, `verify:public` runtime and declaration checks, and package contents pass. For a release change, also import the packed tarball in a disposable consumer. |

## Bootstrap provenance

The repository-wide readiness pass began at `d72bc910ef55ca4e1c7eca00815589c81a6472e5` on 2026-09-26. It assessed all 19 package areas, nine shared areas, HTTP, low-level Sui, WebSocket, wire formats, the npm artifact, docs, and release controls. `AGENTS.md` and this map are the durable entrypoints. `bun run agent:doctor` checks the local toolchain and referenced path/script presence; `bun install --frozen-lockfile` checks lock consistency, and CI runs the tests, built package, docs, and release gates. Local evidence, receipts, and the full coverage ledger live under ignored `.agent/bootstrap/` for this run; a future pass should reconcile this section with the current code and checks rather than add a parallel setup path.
