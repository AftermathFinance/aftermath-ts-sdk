# aftermath-ts-sdk

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
