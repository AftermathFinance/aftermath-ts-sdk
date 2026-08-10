---
"aftermath-ts-sdk": patch
---

Move the SDK's internal fullnode client from `SuiJsonRpcClient` to `SuiGrpcClient`. Sui JSON-RPC was disabled on Sui Foundation fullnodes in July 2026 and is scheduled for removal from the node code in mid-October 2026; every read the SDK performs now speaks gRPC, except three helpers with no gRPC equivalent.

Object-content reads go through gRPC's `json` view, whose Move field shapes differ from JSON-RPC's `content.fields`: nested structs lose their `fields` wrapper and `type`, `vector<u8>` arrives base64-encoded, and `UID` flattens to a bare string. `GrpcCasting` adds `unwrapStructField`, `bytesFieldToNumbers` and `unwrapUid` to absorb this, and every caster was ported against fixtures captured from mainnet in both protocols. `u64` is an identical decimal string on both, so the `BigIntAsString` contract is unchanged.

**Breaking:** the exported `*FromSuiObjectResponse` / `*FromSuiObject` casters now take the gRPC object shape as their **input** parameter. Their return types are unchanged, so callers using the high-level `Aftermath` classes are unaffected — only code feeding raw fullnode responses directly into a caster needs updating.

**Breaking:** `AftermathApi.jsonRpcClient` is now optional (`SuiJsonRpcClient | undefined`), since JSON-RPC is only needed by `Events().fetchCastEventsWithCursor`, `Transactions().fetchTransactionsWithCursor` and the deprecated `Sui().fetchSystemState`. Those three throw a descriptive error when it is absent; everything else goes over gRPC. `new AftermathApi(client, addresses)` is now valid, and code reading the field directly needs a narrowing check.

**Behaviour change:** `Objects().fetchObjectBatch` drops per-object error entries rather than letting one missing object throw from inside a caster and lose the whole batch — gRPC's `getObjects` has a per-object error arm that `multiGetObjects` did not.

Note that `Helpers.getObjectType` returns a slightly different string for generic-bearing types under gRPC: addresses inside generic parameters are zero-padded and the post-comma space is dropped. Object ids are unaffected. This exposes a pre-existing bug in `Helpers.addLeadingZeroesToType`, which never normalized generic parameters; it is not fixed here.
