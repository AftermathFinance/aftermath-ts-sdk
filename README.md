# Aftermath SDK

The Aftermath SDK provides easy access to Aftermath Finance's protocols on the Sui blockchain. Please note that not all of our protocols are on Testnet, but all of them are Mainnet.

## Installation

```bash
npm i aftermath-ts-sdk @mysten/sui @mysten/sui.js
```

## Quick Start (Aftermath SDK)

For most integrations, use the Aftermath SDK for simplified access:

```typescript
const afSdk = new Aftermath("MAINNET"); // "MAINNET" | "TESTNET"
await afSdk.init(); // initialize provider

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
const afSdk = new Aftermath("MAINNET");
const addresses = afSdk.getAddresses();

const afApi = new AftermathApi(
	new SuiClient({
		transport: new SuiHTTPTransport({
			url: "https://fullnode.mainnet.sui.io",
		}),
	}),
	addresses // Configuration addresses
);

// Access protocol APIs
const poolsApi = afApi.Pools();
const stakingApi = afApi.Staking();
const farmsApi = afApi.Farms();
```

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
