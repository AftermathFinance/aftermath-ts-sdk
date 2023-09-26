# Aftermath TypeScript SDK

## Install

```bash
npm i aftermath-ts-sdk
```

## Usage

Create an instance of `Aftermath` for ease of use to make calls to our server, or create an instance of `AftermathApi` for finer control of transaction construction.

## Aftermath SDK

### 1. Create Aftermath provider

```ts
const afSdk = new Aftermath("MAINNET"); // "MAINNET" | "TESTNET" | "DEVNET"
```

### 2. Create protocol provider

```ts
const router = afSdk.Router();
const pools = afSdk.Pools();
const staking = afSdk.Staking();
const farms = afSdk.Farms();
```

## Aftermath API

### 1. Create Aftermath Api provider

```ts
const fullnodeEndpoint = "https://fullnode.mainnet.sui.io";
const addresses = {...};

const afApi = new AftermathApi(
	new SuiClient({
		transport: new SuiHTTPTransport({
			url: fullnodeEndpoint,
		}),
	}),
	addresses,
	new IndexerCaller("MAINNET"), // "MAINNET" | "TESTNET" | "DEVNET"
);
```

### 2. Create protocol provider

```ts
const poolsApi = afApi.Pools();
const stakinApi = afApi.Staking();
const farmsApi = afApi.Farms();
```

Find the complete documentation for using our router, AMM pools, liquid staking, and more in our [GitBook](https://docs.aftermath.finance/aftermath-typescript-sdk/getting-started).
