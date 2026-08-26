# Handle cancellation and transport errors

Use a caller-owned `AbortController` when a request belongs to a page, route,
or task that can disappear before the response arrives. Handle
`AftermathTransportError` at the HTTP boundary, and let errors from Sui clients,
wallets, and on-chain execution keep their original boundary.

This guide assumes that you created an `Aftermath` provider. For setup, see
[Configure and bootstrap the SDK](./configure-and-bootstrap.md).

## Cancel a supported HTTP read

Pass the signal as the final argument to a method whose signature accepts an
`AbortSignal`:

```ts
import { Aftermath } from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });
const controller = new AbortController();
const request = sdk.Pools().getAllPools(controller.signal);

controller.abort();

try {
	await request;
} catch (error) {
	console.log(error);
}
```

Pass a signal to `Aftermath.create` only when you need to cancel address
discovery:

```ts
const controller = new AbortController();
const sdk = await Aftermath.create(
	{ network: "MAINNET" },
	controller.signal
);
```

If you provide `addresses` or `api`, the factory skips address discovery, so
that signal has no discovery request to cancel. Many SDK methods do not accept
a signal. Check the generated method signature before passing one. For
example, the high-level `Wallet` methods and the low-level `AftermathApi`
helpers do not expose a cancellation parameter.

Aborting a request does not cancel a transaction that a wallet has already
submitted to Sui.

## Identify an HTTP transport failure

Use `isAftermathTransportError` where your application handles HTTP failures:

```ts
import {
	Aftermath,
	isAftermathTransportError,
} from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });

try {
	await sdk.Prices().getCoinPrice({ coin: "0x2::sui::SUI" });
} catch (error) {
	if (!isAftermathTransportError(error)) throw error;

	if (error.kind === "http" && error.status === 429) {
		if (error.retryAfterMs !== undefined) {
			console.log(`Retry after ${error.retryAfterMs} ms.`);
		}
	}
}
```

`AftermathTransportError.kind` is one of these values:

- `http` means the server returned a non-2xx response. `status` contains the
  HTTP status when the response provided one.
- `network` means the request could not reach a usable endpoint.
- `abort` means the caller cancelled the request. `abortSource` is
  `caller` unless the runtime identified a timeout.
- `timeout` means the transport or runtime reported a timeout.
- `decode` means the response could not be parsed as the expected JSON value.

`retryAfterMs` is derived from a valid `Retry-After` header. `code` contains an
underlying transport code when one exists. `cause` contains the original
thrown value when one exists. These fields are optional.

## Preserve errors outside the HTTP boundary

The type guard identifies only errors normalized by the SDK's HTTP `Caller`.
Re-throw values that it does not recognize so programming and wallet errors
remain visible.

The `SuiGrpcClient` and optional `SuiJsonRpcClient` used by `AftermathApi` do
not convert their failures to `AftermathTransportError`. Low-level object
helpers can wrap gRPC failures in a regular `Error`. Move errors occur during
transaction execution and are not HTTP transport errors.

## Configure the optional JSON-RPC helpers

`AftermathApi` requires a `SuiJsonRpcClient` only for these compatibility
methods:

- `api.Events().fetchCastEventsWithCursor`
- `api.Transactions().fetchTransactionsWithCursor`
- `api.Sui().fetchSystemState`

Low-level wrappers that delegate to those helpers also need JSON-RPC. They
include `api.Wallet().fetchPastTransactions`, the two faucet event methods, the
four SuiFrens event methods, and `api.SuiFrens().fetchSuiFrenStats`.

If the third constructor argument is missing, these methods throw a regular
configuration `Error`. Use the [remaining JSON-RPC call list](../../README.md#understand-the-remaining-json-rpc-calls)
to choose the client before calling the helper.
