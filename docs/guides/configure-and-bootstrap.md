# Configure and bootstrap the SDK

Create an `Aftermath` provider when your application wants the SDK to resolve
network-specific addresses and construct the Sui clients. This guide assumes
that you installed `aftermath-ts-sdk` and its `@mysten/sui` 2.x peer dependency.

For the provider model, see [Understand the provider layers](../explanation/provider-layers.md).

## Create a provider for a named network

Pass one of the supported `SuiNetwork` values to `Aftermath.create`:

```ts
import { Aftermath } from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });
const pools = sdk.Pools();
```

The factory returns a ready-to-use `Aftermath` instance. The default network is
`MAINNET`. The selected network supplies the canonical Aftermath API host and
Sui fullnode URL unless you override them.

The factory fetches `ConfigAddresses` before it returns unless you provide
`addresses` or `api`. A protocol accessor can still fail when the selected
network does not include the address section that the package requires.

## Use custom hosts

Set `baseUrl` to the Aftermath API host and `fullnodeUrl` to the Sui fullnode
URL:

```ts
const sdk = await Aftermath.create({
	network: "TESTNET",
	baseUrl: "https://api.example.test",
	fullnodeUrl: "https://fullnode.example.test",
});
```

Set `apiEndpoint` when the API uses a path segment other than `api`:

```ts
const sdk = await Aftermath.create({
	network: "TESTNET",
	baseUrl: "https://api.example.test",
	apiEndpoint: "sdk-api",
});
```

Keep the host in `baseUrl` and the path segment in `apiEndpoint`. The factory
passes `fullnodeUrl` to `SuiGrpcClient` as `baseUrl` and to
`SuiJsonRpcClient` as `url` when it constructs those clients.

## Reuse resolved addresses

Pass a trusted `ConfigAddresses` value for the same network to skip address
discovery:

```ts
import { Aftermath } from "aftermath-ts-sdk";

const discoverySdk = await Aftermath.create({ network: "MAINNET" });
const addresses = await discoverySdk.getAddresses();

const sdk = await Aftermath.create({
	network: "MAINNET",
	addresses,
});
```

Cache addresses only with the network they describe. An address set from one
network cannot configure package-backed transactions on another network.

## Supply a pre-built API provider

Pass `api` when your application owns the Sui client lifecycle or needs to
choose the optional JSON-RPC client itself:

```ts
const sdk = await Aftermath.create({ api: existingApi });
```

Here, `existingApi` is an `AftermathApi` that already contains the Sui client,
the matching `ConfigAddresses`, and, when needed, a `SuiJsonRpcClient`. This
option skips address discovery, `SuiGrpcClient` construction, and
`SuiJsonRpcClient` construction.

The factory still creates HTTP-backed accessors from its own options. Set
`network`, `baseUrl`, or `apiEndpoint` when those accessors must use a custom
Aftermath API host.

## Construct `AftermathApi` directly

Use `AftermathApi` when you need direct access to low-level object, transaction,
Move, and Sui helpers:

```ts
import { Aftermath, AftermathApi } from "aftermath-ts-sdk";
import { SuiGrpcClient } from "@mysten/sui/grpc";

const bootstrap = await Aftermath.create({ network: "MAINNET" });
const addresses = await bootstrap.getAddresses();
const fullnodeUrl = "https://fullnode.mainnet.sui.io:443";

const client = new SuiGrpcClient({
	network: "mainnet",
	baseUrl: fullnodeUrl,
});

const api = new AftermathApi(client, addresses);
const poolsApi = api.Pools();
```

Constructing `AftermathApi` performs no network I/O. Its helper methods do. Most
fullnode helpers use gRPC. Add a `SuiJsonRpcClient` as the third constructor
argument only for the direct compatibility methods or wrappers listed in
[Understand the remaining JSON-RPC calls](../../README.md#understand-the-remaining-json-rpc-calls).
