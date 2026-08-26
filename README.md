# Aftermath TypeScript SDK

The Aftermath TypeScript SDK provides typed access to Aftermath Finance
protocols and Sui on-chain data. It supports the Sui `MAINNET`, `TESTNET`,
`DEVNET`, and `LOCAL` networks. A protocol can be unavailable on a selected
network.

Use the high-level `Aftermath` provider for most applications. Use
`AftermathApi` when you need direct control of Sui clients, package addresses,
or low-level transaction and object helpers.

## Choose a path

For a first integration, follow the [high-level provider quick start](#create-the-high-level-provider).

For a focused task, use these guides:

- [Configure and bootstrap the SDK](./docs/guides/configure-and-bootstrap.md)
- [Build and execute a transaction](./docs/guides/build-and-execute-transactions.md)
- [Handle cancellation and transport errors](./docs/guides/handle-cancellation-and-errors.md)
- [Query Sui data](./docs/guides/query-sui-data.md)

For the provider and transport model, read [Understand the provider layers](./docs/explanation/provider-layers.md).
For complete symbol-level facts, open the [generated API reference](https://github.com/AftermathFinance/aftermath-ts-sdk/tree/docs/docs).
For documentation maintenance rules, see the [SDK documentation guide](./docs/DOCUMENTATION_GUIDE.md).

## Install the package

Install the SDK and its `@mysten/sui` peer dependency in the application that
imports them:

```bash
npm install aftermath-ts-sdk @mysten/sui@^2
```

The SDK supports `@mysten/sui` versions `>=2.0.0` and `<3.0.0`.

## Create the high-level provider

```ts
import { Aftermath } from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });
const supportedCoins = await sdk.Router().getSupportedCoins();

console.log(supportedCoins);
```

The call to `Aftermath.create` is asynchronous because the factory discovers
the selected network's Aftermath addresses. The factory skips address
discovery when you provide `addresses` or a pre-built `api`.

The quick start calls the Aftermath HTTP API and returns an array of Sui coin
type strings. Check protocol availability before using an accessor on a
network that does not publish that protocol's address section.

### Configure a network or endpoint

Pass `network` to use the SDK's canonical Aftermath API and Sui fullnode URLs:

```ts
const sdk = await Aftermath.create({ network: "TESTNET" });
```

Use `baseUrl` for the Aftermath API host. Use `fullnodeUrl` for the Sui fullnode
host. When the factory creates the clients, it passes `fullnodeUrl` to
`SuiGrpcClient` as `baseUrl` and to `SuiJsonRpcClient` as `url`.

```ts
const sdk = await Aftermath.create({
	network: "MAINNET",
	baseUrl: "https://api.example.test",
	fullnodeUrl: "https://fullnode.example.test",
});
```

Use `apiEndpoint` for the path segment between `baseUrl` and a provider path.
It defaults to `api`. Keep the host in `baseUrl` and the path segment in
`apiEndpoint`.

Use `addresses` when your application already has a trusted
`ConfigAddresses` value for the selected network. Use `api` when your
application owns the Sui client lifecycle. The `api` option also supplies the
address configuration, so the factory skips address discovery and client
construction.

See [Configure and bootstrap the SDK](./docs/guides/configure-and-bootstrap.md)
for complete setup variants.

## Select a protocol or utility

Each accessor returns a configured object. Call the accessor before calling a
package method.

| Accessor | Purpose |
| --- | --- |
| `sdk.Pools()` | AMM pool reads, liquidity transactions, and pool math. |
| `sdk.Router()` | Multi-pool trade routes and router transactions. |
| `sdk.Staking()` | afSUI staking, unstaking, validator data, and staking transactions. |
| `sdk.Farms()` | Staking pools, farm positions, lock periods, and rewards. |
| `sdk.Dca()` | Dollar-cost averaging orders and DCA transactions. |
| `sdk.LimitOrders()` | Limit-order reads and transaction builders. |
| `sdk.Perpetuals()` | Perpetual markets, accounts, orders, previews, and vaults. |
| `sdk.NftAmm()` | NFT AMM markets, NFT reads, and NFT transactions. |
| `sdk.SuiFrens()` | SuiFren objects, accessories, staking, and related events. |
| `sdk.Faucet()` | Faucet reads and mint transactions on supported networks. |
| `sdk.GasPools()` | Shared gas-pool reads and sponsored transactions. |
| `sdk.Multisig()` | Multisig address data and transaction-related requests. |
| `sdk.Referrals()` | Referral-program reads and transactions. |
| `sdk.Rewards()` | User reward data and claim transactions. |
| `sdk.UserData()` | User public-key and account message flows. |
| `sdk.Coin(coinType?)` | Coin metadata, decimals, prices, and verified coins. |
| `sdk.Wallet(address)` | Balance and transaction-history reads for an address. |
| `sdk.Sui()` | Sui chain data and system operations. |
| `sdk.Prices()` | Coin price and price-info reads. |
| `sdk.DynamicGas()` | Dynamic-gas transaction preparation through the Aftermath API. |
| `sdk.Auth()` | Authentication and access-token flows. |

`sdk.ReferralVault()` remains available for compatibility and is deprecated.
Use `sdk.Referrals()` for new code.

## Build a transaction

Transaction builders are package-specific. For example,
`sdk.Staking().getStakeTransaction` returns an unsigned Sui `Transaction`,
performs gRPC coin selection, and does not sign or execute the transaction.
The `walletAddress` becomes the transaction sender and recipient. The selected
validator must be active on the target network.

```ts
import { Aftermath } from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });

// Replace these example addresses with addresses on the selected network.
const walletAddress = "0x1";
const validatorAddress = "0x4";

const stakeTx = await sdk.Staking().getStakeTransaction({
	walletAddress,
	suiStakeAmount: 1_000_000_000n,
	validatorAddress,
});

// Sign and execute `stakeTx` with the wallet integration used by your app.
```

`suiStakeAmount` is a raw SUI amount in MIST. `1_000_000_000n` represents 1
SUI. Read the method's reference entry before using another transaction
builder because inputs, return types, and network requirements differ by
package.

See [Build and execute a transaction](./docs/guides/build-and-execute-transactions.md)
for sender, exact-amount, and sponsored-transaction guidance.

## Use the low-level API provider

`AftermathApi` accepts a `SuiGrpcClient`, the resolved `ConfigAddresses`, and an
optional `SuiJsonRpcClient`:

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

The low-level provider exposes `DynamicFields()`, `Events()`, `Inspections()`,
`Objects()`, `Transactions()`, `Wallet()`, `Nfts()`, `Coin()`, `Sui()`,
`Pools()`, `Faucet()`, `SuiFrens()`, `Staking()`, `NftAmm()`,
`ReferralVault()`, `Perpetuals()`, `Farms()`, `Dca()`, `Multisig()`,
`LimitOrders()`, and `Router()`.

These accessors are low-level helpers. They use the configured Sui client,
build Move transactions, or run local conversions. They are not the same
surface as the high-level HTTP accessors on `Aftermath`.

## Understand the remaining JSON-RPC calls

Most `AftermathApi` fullnode operations use `SuiGrpcClient`. These direct
helpers require the optional `SuiJsonRpcClient` in the current source:

| Helper | Reason |
| --- | --- |
| `api.Events().fetchCastEventsWithCursor` | `suix_queryEvents` has no equivalent on `SuiGrpcClient`. |
| `api.Transactions().fetchTransactionsWithCursor` | `suix_queryTransactionBlocks` has no equivalent on `SuiGrpcClient`. |
| `api.Sui().fetchSystemState` | The gRPC API does not return `SuiSystemStateSummary`. This compatibility method is deprecated. |

Construct `AftermathApi` with a `SuiJsonRpcClient` only when your application
uses one of those helpers or a low-level wrapper that delegates to one. The
following wrappers also need the optional client:

- `api.Wallet().fetchPastTransactions`
- `api.Faucet().fetchMintCoinEvents`, `api.Faucet().fetchAddCoinEvents`, and
  `api.Faucet().fetchSupportedCoins`
- `api.SuiFrens().fetchHarvestSuiFrenFeesEvents`,
  `api.SuiFrens().fetchMixSuiFrensEvents`,
  `api.SuiFrens().fetchStakeSuiFrenEvents`,
  `api.SuiFrens().fetchUnstakeSuiFrenEvents`, and
  `api.SuiFrens().fetchSuiFrenStats`

Without that third constructor argument, these methods throw a configuration
`Error`. The factory creates both clients when it performs its own bootstrap.
If you pass a pre-built `api`, the factory uses the clients already present in
that instance.

The high-level `sdk.Sui().getSystemState()` method is a different HTTP API
call. Do not confuse it with the low-level `api.Sui().fetchSystemState`
compatibility method.

## Cancel requests and handle transport errors

Pass a caller-owned `AbortSignal` to `Aftermath.create` to cancel address
discovery. Pass a signal only to methods whose signature accepts a final
`AbortSignal` parameter. The signal is a runtime input. The SDK does not
serialize it into configuration or request bodies.

```ts
import {
	Aftermath,
	isAftermathTransportError,
} from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });
const controller = new AbortController();
const request = sdk.Pools().getAllPools(controller.signal);

controller.abort();

try {
	await request;
} catch (error) {
	if (!isAftermathTransportError(error)) throw error;

	if (error.kind === "abort" && error.abortSource === "caller") {
		console.log("The caller cancelled the request.");
	} else {
		console.error(error.kind, error.status, error.retryAfterMs);
	}
}
```

`AftermathTransportError` normalizes failures from the SDK's HTTP caller:

- `kind` is `http`, `network`, `abort`, `timeout`, or `decode`.
- `status` contains the HTTP status for an HTTP failure, when available.
- `retryAfterMs` contains a parsed, safe delay from `Retry-After`, when available.
- `code` contains an underlying transport code, when one exists.
- `cause` contains the original thrown value, when one exists.
- `abortSource` distinguishes caller cancellation from timeout cancellation.

The gRPC and optional JSON-RPC clients used by `AftermathApi` do not normalize
their errors to `AftermathTransportError`. Sui Move execution errors and errors
from a wallet or signer also remain outside this HTTP error boundary.

See [Handle cancellation and transport errors](./docs/guides/handle-cancellation-and-errors.md)
for the error-handling flow.

## Work with pagination and typed values

Cursor-returning methods expose a page and a cursor. Pass `nextCursor` to the
next request while it is not `null`. Cursor shapes differ by API. Event pages
use `EventId`, transaction pages use a transaction digest, and dynamic-field
pages use a field object ID.

`Balance` is `bigint` and usually represents the coin's smallest unit. Check
the method or field documentation when a value uses another unit. `Timestamp`
is a `number` and can represent milliseconds or seconds. A field name ending
in `Ms` identifies milliseconds, but the containing method remains the final
authority.

`Slippage`, `Percentage`, `Apr`, and `Apy` are decimal fractions in the SDK's
general type aliases. For example, `0.01` represents 1%. `Bps` uses integer
basis points, so `100` represents 1%.

The SDK exports the request and response interfaces used by each package. Let
TypeScript infer a method's return type when possible, and use the generated
reference to look up a named type before constructing an input object.

## Rate limits and support

The default Aftermath API rate limit is 1,000 requests per 10 seconds. Contact
Aftermath if your application needs a higher limit:

- [Telegram](https://t.me/aftermath_fi)
- [Discord](https://discord.gg/VFqMUqKHF3)
- [X](https://x.com/AftermathFi)

Report SDK issues in the [GitHub issue tracker](https://github.com/AftermathFinance/aftermath-ts-sdk/issues).
