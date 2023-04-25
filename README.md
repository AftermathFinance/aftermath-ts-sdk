# Aftermath TypeScript SDK

## Install

```
npm i aftermath-ts-sdk
```

## Usage

### 1. Create Aftermath provider

```
const af = new Aftermath("TESTNET");

/*
DEVNET
TESTNET
*/
```

### 2. Create protocol provider

```
const router = af.Router();
const pools = af.Pools();
```

Find the complete documentation for using our router and AMM pools in our [GitBook](https://aftermath-finance-1.gitbook.io/aftermath-finance/).
