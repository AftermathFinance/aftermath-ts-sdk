# Understand the provider layers

The SDK has two provider layers because applications need both a convenient
HTTP-facing facade and direct control of Sui clients, package addresses, and
Move transactions.

## Use `Aftermath` for application workflows

`Aftermath.create` returns a ready-to-use high-level provider. The factory
selects canonical endpoints, resolves `ConfigAddresses`, creates a
`SuiGrpcClient`, and creates a `SuiJsonRpcClient` for the remaining compatibility
helpers when it owns the low-level clients.

Pass `addresses` to skip address discovery. Pass `api` when another part of the
application owns the low-level clients and address configuration. Accessors
such as `Pools()`, `Staking()`, and `Router()` return a new high-level provider
each time you call them.

A high-level accessor does not by itself identify one transport. High-level
HTTP methods use the Aftermath API. Some package providers also delegate
transaction building or on-chain reads to their `AftermathApi`. Read the
method's reference entry when transport, cancellation, or error behavior
matters.

## Use `AftermathApi` for low-level control

`AftermathApi` binds a `SuiGrpcClient` and network-specific `ConfigAddresses` to
low-level helpers such as `PoolsApi`, `StakingApi`, and `PerpetualsApi`.
Constructing it performs no network I/O. Calling a helper can read through the
Sui client, build a Move transaction, inspect a transaction, or run a local
conversion. A helper that needs an omitted address section throws during
construction.

Use this layer when you need to inject a Sui client, share one low-level API
provider across services, build Move calls, or work with gRPC object views.
Complete low-level transaction builders return unsigned transactions. Command
helpers mutate a caller-owned transaction and return a command result. Neither
kind signs or executes a transaction.

## General helpers have explicit transport boundaries

The transport depends on the helper method:

| Helper or method | Transport and behavior |
| --- | --- |
| `api.Objects()` | Uses `SuiGrpcClient` for object reads and pagination. |
| `api.DynamicFields()` | Uses `SuiGrpcClient` for dynamic-field listing and object reads. |
| `api.Events().fetchCastEventsWithCursor` | Uses the optional `SuiJsonRpcClient` for `suix_queryEvents`. |
| `api.Transactions().fetchTransactionsWithCursor` | Uses the optional `SuiJsonRpcClient` for `suix_queryTransactionBlocks`. |
| `api.Sui().fetchSystemState` | Uses the optional `SuiJsonRpcClient` and is deprecated. |
| `api.Wallet().fetchPastTransactions` | Delegates to `api.Transactions().fetchTransactionsWithCursor`, so it also needs JSON-RPC. |

The low-level faucet and SuiFrens event methods delegate to the event helper.
That includes `api.Faucet().fetchMintCoinEvents`,
`api.Faucet().fetchAddCoinEvents`, the four `api.SuiFrens()` event methods,
and `api.SuiFrens().fetchSuiFrenStats`. These methods also need the optional
JSON-RPC client. The high-level `sdk.Wallet().getPastTransactions` and
`sdk.Sui().getSystemState` are different HTTP methods.

If a JSON-RPC-dependent method is called without the optional client, the SDK
throws a configuration `Error`. The gRPC and JSON-RPC client errors are not
converted to `AftermathTransportError` by this low-level layer.

See [Configure and bootstrap the SDK](../guides/configure-and-bootstrap.md) for
construction examples, [Query Sui data through the SDK](../guides/query-sui-data.md)
for helper calls, and [Handle cancellation and transport errors](../guides/handle-cancellation-and-errors.md)
for the HTTP error boundary.
