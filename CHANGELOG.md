# aftermath-ts-sdk

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
