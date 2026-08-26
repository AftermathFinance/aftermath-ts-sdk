# Query Sui data through the SDK

Use high-level package facades for Aftermath data. Use `AftermathApi` helpers
for general Sui objects, dynamic fields, events, and transaction history.

This guide assumes that you installed `aftermath-ts-sdk` and its
`@mysten/sui` 2.x peer dependency. Replace the example object IDs and wallet
address with values that exist on the selected network.

## Create a low-level provider

The setup below includes the optional JSON-RPC client because the event and
transaction-history examples need it. Omit `jsonRpcClient` and the third
`AftermathApi` argument when you only use gRPC helpers.

```ts
import { Aftermath, AftermathApi } from "aftermath-ts-sdk";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const bootstrap = await Aftermath.create({ network: "MAINNET" });
const addresses = await bootstrap.getAddresses();
const fullnodeUrl = "https://fullnode.mainnet.sui.io:443";

const grpcClient = new SuiGrpcClient({
	network: "mainnet",
	baseUrl: fullnodeUrl,
});
const jsonRpcClient = new SuiJsonRpcClient({
	network: "mainnet",
	url: fullnodeUrl,
});

const api = new AftermathApi(grpcClient, addresses, jsonRpcClient);
```

`AftermathApi` construction performs no network I/O. The helper methods do.
The address configuration and both clients must target the same network.

## Read an object through gRPC

Call `fetchObject` with an existing object ID:

```ts
const objectId = "0x2";
const object = await api.Objects().fetchObject({ objectId });

console.log(object.objectId, object.json);
```

The return value is a gRPC object view. It is not the JSON-RPC
`SuiObjectResponse` envelope, so read `object.json` instead of
`object.data.content.fields`. `fetchObject` requests the JSON view by default.
Set `withDisplay: true` when a caster or caller needs Display output:

```ts
const object = await api.Objects().fetchObject({
	objectId,
	withDisplay: true,
});
```

`fetchObject` throws a regular `Error` when the gRPC fullnode cannot return the
object. It does not return `undefined` for a missing object.

## Cast an object locally

Use `fetchCastObject` when the returned object must become an application type:

```ts
const castObject = await api.Objects().fetchCastObject({
	objectId,
	objectFromSuiObjectResponse: (object) => ({
		objectId: object.objectId,
		objectType: object.type,
	}),
});
```

The caster runs after the gRPC request. The caster receives the gRPC object view,
not a JSON-RPC response. Request `withDisplay: true` when the caster reads
Display fields.

## Read owned objects

Pass the owner address and an optional exact Move object type:

```ts
const walletAddress = "0x1";
const coinObjectType = "0x2::coin::Coin<0x2::sui::SUI>";

const coinObjects = await api.Objects().fetchOwnedObjects({
	walletAddress,
	objectType: coinObjectType,
});
```

`fetchOwnedObjects` follows gRPC pagination with a maximum request size of 50
objects and returns the accumulated object views. It does not return a cursor.
Use `fetchObjectsOfTypeOwnedByAddress` when you want the same exact-type query
with that method's name, or use a package facade when the SDK already provides
a typed caster.

## Read dynamic fields

Use `DynamicFields()` when no package facade owns the parent object's field:

```ts
const parentObjectId = "0x5";
const fieldPage = await api.DynamicFields().fetchDynamicFieldsOfTypeWithCursor({
	parentObjectId,
	limit: 50,
});

console.log(fieldPage.dynamicFields, fieldPage.nextCursor);
```

`limit` counts fields. `nextCursor` is a field object ID or `null`. Pass a
non-null cursor to the next request. Set `dynamicFieldType` to an exact Move
type string or to a predicate when you need a type filter.

To load a dynamic object field, convert the returned base64 BCS name to the
`Uint8Array` expected by gRPC:

```ts
import { fromBase64 } from "@mysten/sui/utils";

const field = fieldPage.dynamicFields[0];
if (field) {
	const fieldObject = await api.DynamicFields().fetchDynamicFieldObject({
		parentId: parentObjectId,
		name: {
			type: field.name.type,
			bcs: fromBase64(field.bcsName),
		},
	});
	console.log(fieldObject.objectId);
}
```

`fetchDynamicFieldObject` expects `name: { type, bcs }`. Do not pass the
JSON-RPC form `name: { type, value }`. Dynamic-field listing and object loading
use gRPC and can throw errors from the configured `SuiGrpcClient`.

## Read events with a JSON-RPC compatibility helper

`fetchCastEventsWithCursor` uses the optional `SuiJsonRpcClient` because gRPC
does not provide an equivalent to `suix_queryEvents`:

```ts
const eventPage = await api.Events().fetchCastEventsWithCursor<
	{ type: string },
	{ type: string }
>({
	query: { MoveEventType: "0x2::module::Event" },
	eventFromEventOnChain: (event) => ({ type: event.type }),
	limit: 50,
});

console.log(eventPage.events, eventPage.nextCursor);
```

Replace the example event type with the fully qualified Move event type that
you want to query. `nextCursor` is an `EventId` or `null`. Pass it to the next
request until it is `null`. The helper converts the cursor's `eventSeq` to the
string form required by JSON-RPC.

## Read transaction history with a JSON-RPC compatibility helper

`fetchTransactionsWithCursor` queries transactions with the Sui JSON-RPC
filter type:

```ts
const transactionPage = await api.Transactions().fetchTransactionsWithCursor({
	query: {
		filter: { FromAddress: walletAddress },
	},
	limit: 50,
});

console.log(transactionPage.transactions, transactionPage.nextCursor);
```

The method requests input, effects, events, balance changes, and object changes
for each returned transaction. Its `nextCursor` is a transaction digest or
`null`. Pass that digest to the next request while it is not `null`.

The low-level `api.Wallet().fetchPastTransactions` method delegates to this
transaction helper. It also requires the optional JSON-RPC client. The
high-level `sdk.Wallet().getPastTransactions` method uses the Aftermath HTTP
API instead.

## Keep the transport boundary in mind

Object and dynamic-field helpers in this guide use `SuiGrpcClient`. The two
history helpers use the optional `SuiJsonRpcClient`. If the optional client is
missing, the history helpers throw a configuration `Error` before making a
request. Low-level faucet and SuiFrens event wrappers use the same optional
client. These low-level helpers do not normalize failures to
`AftermathTransportError` and do not accept an `AbortSignal`.

For Aftermath HTTP endpoints and their normalized transport errors, see
[Handle cancellation and transport errors](./handle-cancellation-and-errors.md).
