# aftermath-ts-sdk

## 5.0.1

### Patch Changes

- [#182](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/182) [`3e01a82`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/3e01a82f989c231748e008c55ae78a340d98554a) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Add optional `description` to `PerpetualsMarketMetadata`.

  The static enricher can now carry a long-form blurb per market alongside the
  existing display name and artwork. Optional because it is omitted for markets
  that have not been given one.

## 5.0.0

### Major Changes

- [#180](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/180) [`cd9cbf7`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/cd9cbf74cef5fae78bd2f32fb7e2e42d77a8f6cb) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Remove `Rewards.getExpectedRewards` and its types.

  The backing `rewards/expected-rewards` endpoint has been removed from the API,
  so the method could only fail. Callers previewing an epoch's rewards should use
  `getDistribution` instead.

  Removed alongside it: `ApiRewardsExpectedRewardsBody`,
  `ApiRewardsExpectedRewardsResponse`, `RewardsExpectedCalculationVariables`,
  `RewardsExpectedEpochInfo`, `RewardsExpectedTotals` and
  `RewardsExpectedDomainTokens`.

## 4.1.1

### Patch Changes

- [#177](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/177) [`bc92529`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/bc925294f95c179a3c8857905902c0e2bd6efe04) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Add optional `markPrice` to `PerpetualsMarketData`.

  The websocket market stream carries a mark price alongside the index, but the
  type never declared it, so consumers reading it had to widen the type
  themselves. REST responses are built from an indexer payload with no mark
  price and omit the field, hence optional.

  `markPrice` was already on `PerpetualsWsUpdatesOraclePayload`; this covers the
  market stream, which fills the window before the first oracle tick arrives.

  Also corrects `PerpetualsWsUpdatesOraclePayload.bookPrice` from `number | null`
  to optional. The API does send JSON `null`, but the websocket parser
  (`parseJsonWithBigint`) maps every `null` to `undefined` before handing the
  message to consumers, so the old type described a value that never arrives and
  a `=== null` check could never match.

## 4.1.0

### Minor Changes

- [#175](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/175) [`f3b60ec`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/f3b60ec76b1a8c338e34b190a1a603bec034e8f8) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Restore `Perpetuals.getCsvRebates()` and `Perpetuals.getReferralCsvRebates()`.

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

- [`0d478c0`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/0d478c07103a7c9045141f7f200b902dba0a34cd) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Replace the perpetuals rebates endpoints with `Rewards.getDistribution()`.

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

- [#174](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/174) [`f4d4bd4`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/f4d4bd4dd5643a72885dd8b4555e41a904dde28a) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Add `markPrice` and `bookPrice` to the perpetuals oracle websocket payload.

  `markPrice` is the price positions are marked against for PnL and liquidation,
  as opposed to the raw index. `bookPrice` is the raw orderbook mid and is `null`
  when either side of the book is empty — mark falls back to the index price
  upstream, whereas a raw mid has no meaningful fallback.

## 4.0.0

### Major Changes

- [#171](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/171) [`b424c15`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/b424c15eabf83bc0d8fde8a46520658a76783c98) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Router, DCA and limit-order transaction builders now call the versioned `v1`
  API routes, which return a base64 `TransactionKind` instead of a gas-resolved
  transaction.

  The unversioned routes round-trip the built transaction through a legacy
  v1-JSON serializer that cannot encode the `FundsWithdrawal` input the API emits
  when the input coin is sourced from an address balance. They fail for wallets
  holding a balance there, and are left unchanged for existing integrators.

  Affected: `Router.getTransactionForCompleteTradeRoute`,
  `Router.addTransactionForCompleteTradeRoute`, `Dca.getCreateDcaOrderTx` and
  `LimitOrders.getCreateLimitOrderTx`.

  Breaking:

  - **The returned transaction carries no gas data.** A `TransactionKind` has no
    budget, price, owner or payment, so the caller owns gas — a wallet resolves it
    at signing time, or dynamic gas rewrites it. Code reading `gasData` off the
    returned transaction, or submitting it without a wallet that fills gas, must
    change. The sender is still set.
  - **`Router.addTransactionForCompleteTradeRoute` now requires an
    `AftermathApi`.** It serializes the supplied transaction into a kind, which
    needs a client to resolve object references. `Aftermath.create()` supplies one;
    a directly constructed `new Router(config)` does not and will throw. `Router`
    accepts the provider as an optional second constructor argument.
  - **`ApiRouterAddTransactionForCompleteTradeRouteBody.serializedTx` is now
    `txKind`**, and the add-trade response field `tx` is now `txKind`.

  Each affected builder has a `…Deprecated` counterpart keeping the previous
  behaviour against the unversioned routes, for callers that need the old shape
  while they migrate: `getTransactionForCompleteTradeRouteDeprecated`,
  `addTransactionForCompleteTradeRouteDeprecated`,
  `getCreateDcaOrderTxDeprecated` and `getCreateLimitOrderTxDeprecated`. They
  carry the same address-balance limitation as the endpoints behind them.

## 3.3.3

### Patch Changes

- [#167](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/167) [`681f48b`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/681f48b732adfa168b71e53ebaadaeb63b9fb4f4) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Reverts `Router.addTransactionForCompleteTradeRoute()` to the v1 `serialize()`
  wire format. Only the dynamic gas endpoint requires v2; the service behind
  `transactions/add-trade` still reads v1, so that one has to move on both sides
  at once.

## 3.3.2

### Patch Changes

- [`69fa3d6`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/69fa3d6e7ccb6f001fb66725dee68d6aa85bb665) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - `DynamicGas.getUseDynamicGasForTx()` and
  `Router.addTransactionForCompleteTradeRoute()` now send transactions as v2 JSON
  (`toJSON()`) rather than the deprecated v1 `blockData` shape (`serialize()`),
  which the services reject as invalid input.

## 3.3.1

### Patch Changes

- [#163](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/163) [`3728026`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/3728026ec3a78e8b68abdccc62e8e41ad93051dd) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Removes `Coin.getCoinsWithAmounts()` and its `CoinsWithAmountsGasData` /
  `CoinsWithAmountsGasCoin` types. It wrapped the service's
  `/coins/coins-with-amounts` endpoint, which no caller adopted; treating it as
  withdrawn now rather than leaving an unused transaction-building surface in the
  public API. Everything else added in 3.3.0 is unaffected.

- [#163](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/163) [`3728026`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/3728026ec3a78e8b68abdccc62e8e41ad93051dd) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - `Wallet.getBalances()` and `Wallet.getAllBalances()` call the `coin-balances`
  and `all-coin-balances` service endpoints again, as they always did. Routing
  them to the gRPC provider was the wrong layer: it gave the SDK a second source
  of truth for balances and papered over the service endpoints under-reporting
  SIP-58 address balances, which is fixed service side instead.

## 3.3.0

### Minor Changes

- [`ba82ead`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/ba82ead88b6c7042ce15fb86af4e1d3fdf0096a6) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - `Wallet.getAllBalances()` and `Wallet.getBalances()` now read through the gRPC
  provider, so a wallet's SIP-58 address balance counts towards its reported
  balance. The service endpoints they used before (`all-coin-balances`,
  `coin-balances`) sum owned `Coin<T>` objects only, so a wallet holding its funds
  in the accumulator reported zero.

  These reads now require an `AftermathApi` and throw without one, rather than
  falling back to those endpoints and returning a quietly wrong balance. Only
  `Aftermath.Wallet()` can produce a `Wallet`, and it always supplies a provider,
  so no supported construction path is affected.

  Adds `Coin.getCoinsWithAmounts()`, wrapping `/coins/coins-with-amounts`: it
  sources the requested amounts from owned coins and the address balance, appends
  the coin-sourcing commands to a `TransactionKind`, and returns the extended kind
  with one coin argument per requested amount.

## 3.2.0

### Minor Changes

- [`a669c16`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/a669c16782d457447af8dec45cc4c52fbc3f10cb) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - `fetchCoinWithAmountTx` / `fetchCoinsWithAmountTx` now source coins via the
  `CoinWithBalance` intent, making them SIP-58 address-balance aware: wallets
  whose funds live in the address-balance accumulator (previously "wallet does
  not have coins of sufficient balance") can now build transactions, and coin
  pagination is skipped entirely on this path. Sponsored transactions keep the
  owned-coin selector, since the sponsor's V1 gas-rewrite cannot encode the
  intent's FundsWithdrawal input. An up-front total-balance check preserves the
  canonical insufficient-balance error.

## 3.1.1

### Patch Changes

- [`c01aecd`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/c01aecd435a6cace422460c3f1d98ef064ad406a) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - `fetchCoinsWithAtLeastAmount` now stops paginating as soon as the fetched coins cover the requested amount (with a 50-page backstop), instead of enumerating the wallet's entire coin list first. Coin-dust wallets with 100k+ coin objects previously made every trade build hang for minutes.

## 3.1.0

### Minor Changes

- [#158](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/158) [`868d10e`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/868d10e9c1c65ef89ac5e58db9e11863f2089c09) Thanks [@collin-aftermath](https://github.com/collin-aftermath)! - Add transaction builders for granting and revoking perpetuals vault assistant capabilities.

## 3.0.0

### Major Changes

- [#156](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/156) [`1659a54`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/1659a54bd844e3bf61f2bb91f3f579b9def773ff) Thanks [@collin-aftermath](https://github.com/collin-aftermath)! - Add `Perpetuals.getVaultsConfig()` for fetching current on-chain vault protocol
  limits and remove the obsolete hardcoded `PerpetualsVault.constants` values.
  Integer fields are returned as `bigint`, matching the service's lossless
  `"123n"` wire format. The endpoint uses `POST` with an empty JSON body.

## 2.4.0

### Minor Changes

- [#153](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/153) [`719b327`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/719b327af024271fec23d5a849cf3006d193b648) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Move to one cached Terms and Conditions signature

  af-fe now verifies a single signed message in one place and no longer passes it to the services behind it. The message is the plain string `"Aftermath Terms and Conditions"`, signed once per session and reused everywhere.

  - `UserData.createTermsAndConditionsMessage()` (and `UserData.termsAndConditionsMessage`) returns that canonical string to sign. The old `createSignTermsAndConditionsMessageToSign()` (JSON `{action}`) is deprecated; the backend now rejects the wrapper with error 2034.
  - Fields that used to ride inside the per-action signed message now travel in the request body: `refCode` on `createReferralLink` and `setReferrer`; `orderObjectIds` on `cancelLimitOrder` and `closeDcaOrder`.
  - The per-action `...MessageToSign` helpers (referrals create/link, limit cancel, dca cancel) are deprecated.
  - `PerpetualsSponsorConfig.bytes`/`signature` now carry the cached T&C signature, and `walletAddress` must be the connected wallet (docs only; shape unchanged).

## 2.3.0

### Minor Changes

- [#151](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/151) [`32c4013`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/32c4013e37e46eeb7f98686663e6b126708dd94c) Thanks [@collin-aftermath](https://github.com/collin-aftermath)! - Add typed batch methods for fetching pool and farm summaries with abort-signal support.

- [#151](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/151) [`32c4013`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/32c4013e37e46eeb7f98686663e6b126708dd94c) Thanks [@collin-aftermath](https://github.com/collin-aftermath)! - Add final-positional `AbortSignal` support to Aftermath initialization and
  read methods, plus additive `AftermathTransportError` classification for
  HTTP, network, cancellation, timeout, and decode failures. Existing error
  messages and names remain compatible, including the legacy HTTP error format;
  new structured transport fields are available alongside them.

## 2.2.1

### Patch Changes

- [#149](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/149) [`b524aa9`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/b524aa94d435a1e1ece087d5c98e99cdfc26929f) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Fix `Rewards.getExpectedRewards` to call the kebab-case `rewards/expected-rewards` endpoint, matching the backend path normalization.

## 2.2.0

### Minor Changes

- [#145](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/145) [`2dc2267`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/2dc226745e61274855c570885c960c41714a5eee) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Move the release line to `main`. Releases and `@dev` snapshots are now cut from `main` rather than the `refac/sui-sdk-v2` integration branch, which has been merged and deleted.
