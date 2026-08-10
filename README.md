# Aftermath SDK

The Aftermath SDK provides easy access to Aftermath Finance's protocols on the Sui blockchain. Please note that not all of our protocols are on Testnet, but all of them are Mainnet.

## Installation

```bash
npm i aftermath-ts-sdk
```

## Quick Start (Aftermath SDK)

For most integrations, use the Aftermath SDK for simplified access:

```typescript
// "MAINNET" | "TESTNET" | "DEVNET" | "LOCAL"
const afSdk = await Aftermath.create({ network: "MAINNET" });

// Access protocols
const router = afSdk.Router();
const pools = afSdk.Pools();
const staking = afSdk.Staking();
const farms = afSdk.Farms();
const dca = afSdk.Dca();
```

## Advanced Usage (AftermathApi)

For complex transaction construction, use AftermathApi for direct control:

```typescript
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

const afSdk = await Aftermath.create({ network: "MAINNET" });
const addresses = await afSdk.getAddresses();

const fullnodeUrl = "https://fullnode.mainnet.sui.io";

const afApi = new AftermathApi(
	new SuiGrpcClient({ network: "mainnet", baseUrl: fullnodeUrl }),
	addresses, // Configuration addresses
	// Still required by the few helpers that have no gRPC equivalent — see below
	new SuiJsonRpcClient({ network: "mainnet", url: fullnodeUrl })
);

// Access protocol APIs
const poolsApi = afApi.Pools();
const stakingApi = afApi.Staking();
const farmsApi = afApi.Farms();
```

`Aftermath.create`'s `fullnodeUrl` option takes a **gRPC base URL** (it is passed
to `SuiGrpcClient` as `baseUrl`, and to `SuiJsonRpcClient` as `url`). Sui
fullnodes serve both protocols from the same host, so a single URL is enough.

### Remaining JSON-RPC surface

Sui JSON-RPC is deprecated and scheduled for removal from fullnodes in
mid-October 2026. Every fullnode call this SDK makes goes over gRPC **except**
the following, which cannot be expressed with `SuiGrpcClient` without changing
what they return:

| Helper | Why |
| --- | --- |
| `Events().fetchCastEventsWithCursor` | `suix_queryEvents` has no `SuiGrpcClient` equivalent; `ledgerService.ListEvents` has a different filter model and BCS-only payloads |
| `Transactions().fetchTransactionsWithCursor` | `suix_queryTransactionBlocks` has no gRPC equivalent at all |
| `Objects().fetchObject` / `fetchObjectGeneral` / `fetchObjectBatch` / `fetchOwnedObjects` | gRPC returns Move object contents as BCS bytes or as a differently-shaped `json` view, so the parsed `content.fields` these helpers' casters consume cannot be reproduced |
| `DynamicFields().fetchDynamicFieldObject` | same; gRPC returns the field value as BCS bytes |
| `Sui().fetchSystemState` (deprecated) | gRPC has no `SuiSystemStateSummary` equivalent |

Prefer the Aftermath API (`Aftermath.create(...)`'s high-level providers) for
events, transaction history and system state — those already avoid the fullnode
entirely.

## Available Protocols

### Pools (AMM)

-   Automated Market Maker pools for trading
-   Support for stable and uncorrelated assets
-   Up to 8 assets per pool
-   [View Pools Documentation](https://docs.aftermath.finance/developers/aftermath-ts-sdk/products/pools)

### Router

-   Smart order routing across multiple pools
-   Optimal trade execution via split routes
-   [View Router Documentation](https://docs.aftermath.finance/developers/aftermath-ts-sdk/products/router)

### Staking

-   Liquid staking for SUI tokens
-   Earn yield with afSUI
-   [View Staking Documentation](https://docs.aftermath.finance/developers/aftermath-ts-sdk/products/liquid-staking)

### Farms

-   Yield farming opportunities
-   Stake LP tokens and earn rewards
-   [View Farms Documentation](https://docs.aftermath.finance/developers/aftermath-ts-sdk/products/farms)

### DCA (Dollar-Cost Averaging)

-   Automated periodic investments
-   Reduce impact of market volatility
-   [View DCA Documentation](https://docs.aftermath.finance/developers/aftermath-ts-sdk/products/DCA)

## Rate Limits

Default rate limit: 1000 requests per 10 seconds

For higher limits, contact us via:

-   [Telegram](https://t.me/aftermath_fi)
-   [Discord](https://discord.gg/VFqMUqKHF3)
-   [X/Twitter](https://x.com/AftermathFi)
