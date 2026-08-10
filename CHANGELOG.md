# aftermath-ts-sdk

## 2.1.0

### Patch Changes

- [#140](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/140) [`eb93c41`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/eb93c410989a81d2ed4514853a3f7998638b9ab1) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Move the SDK's internal fullnode client from `SuiJsonRpcClient` to `SuiGrpcClient`. Sui JSON-RPC was disabled on Sui Foundation fullnodes in July 2026 and is scheduled for removal from the node code in mid-October 2026; every read the SDK performs now speaks gRPC, except three helpers with no gRPC equivalent.

  Object-content reads go through gRPC's `json` view, whose Move field shapes differ from JSON-RPC's `content.fields`: nested structs lose their `fields` wrapper and `type`, `vector<u8>` arrives base64-encoded, and `UID` flattens to a bare string. `GrpcCasting` adds `unwrapStructField`, `bytesFieldToNumbers` and `unwrapUid` to absorb this, and every caster was ported against fixtures captured from mainnet in both protocols. `u64` is an identical decimal string on both, so the `BigIntAsString` contract is unchanged.

  **Breaking:** the exported `*FromSuiObjectResponse` / `*FromSuiObject` casters now take the gRPC object shape as their **input** parameter. Their return types are unchanged, so callers using the high-level `Aftermath` classes are unaffected — only code feeding raw fullnode responses directly into a caster needs updating.

  **Breaking:** `AftermathApi.jsonRpcClient` is now optional (`SuiJsonRpcClient | undefined`), since JSON-RPC is only needed by `Events().fetchCastEventsWithCursor`, `Transactions().fetchTransactionsWithCursor` and the deprecated `Sui().fetchSystemState`. Those three throw a descriptive error when it is absent; everything else goes over gRPC. `new AftermathApi(client, addresses)` is now valid, and code reading the field directly needs a narrowing check.

  **Behaviour change:** `Objects().fetchObjectBatch` drops per-object error entries rather than letting one missing object throw from inside a caster and lose the whole batch — gRPC's `getObjects` has a per-object error arm that `multiGetObjects` did not.

  Note that `Helpers.getObjectType` returns a slightly different string for generic-bearing types under gRPC: addresses inside generic parameters are zero-padded and the post-comma space is dropped. Object ids are unaffected. This exposes a pre-existing bug in `Helpers.addLeadingZeroesToType`, which never normalized generic parameters; it is not fixed here.

- [#140](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/140) [`a67b64d`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/a67b64dd99f953e4513e0a7144f8b7ece0b61c9a) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - Migrate the faucet package to the modernized on-chain `AftermathFaucet`. `requestCoinTx` now calls `mint` — which returns the minted `Coin<T>`, transferred to the requester by `buildRequestCoinTx` — and the `AddedCoin` event replaces `AddedCoinEvent`.

  **Breaking:** `FaucetAddresses.objects` now requires the shared `config` object id.

- [#140](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/140) [`3ed0daa`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/3ed0daad6cac7ccf5c609c698b107d6b185fb135) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - `Perpetuals.openUpdatesWebsocketStream` now exposes `subscribeMarketCandles` and `unsubscribeMarketCandles`, so market-candle streams can share the single updates socket instead of a dedicated connection.

- [#140](https://github.com/AftermathFinance/aftermath-ts-sdk/pull/140) [`0c54cc6`](https://github.com/AftermathFinance/aftermath-ts-sdk/commit/0c54cc674e446007ed456c17f986f6de4d0259c1) Thanks [@matical-aftermath](https://github.com/matical-aftermath)! - TWAP orders are now supported for vault accounts: `getCreateTwapOrdersTx`, `getEditTwapOrdersTx`, and `getCancelTwapOrdersTx` route to the vault endpoints instead of throwing, and their request bodies accept either `accountId` or `vaultId`. The user updates websocket payload also includes `twapOrders` alongside `stopOrders`.
