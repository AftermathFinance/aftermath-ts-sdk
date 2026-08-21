# aftermath-ts-sdk

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
