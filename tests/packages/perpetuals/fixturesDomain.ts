import { Transaction } from "@mysten/sui/transactions";

import {
	Perpetuals,
	PerpetualsAccount,
	PerpetualsMarket,
	PerpetualsVault,
} from "@sdk";

import type { AftermathApi } from "@sdk/general/providers/aftermathApi";

import { PerpetualsApiCasting } from "@sdk/packages/perpetuals/api/perpetualsApiCasting";

import type {
	PerpetualsAccountCap,
	PerpetualsAccountObject,
	PerpetualsMarketData,
	PerpetualsMarketMetadata,
	PerpetualsOrderData,
	PerpetualsPosition,
	PerpetualsStopOrderData,
	PerpetualsVaultObject,
	PerpetualsVaultWithdrawRequest,
} from "@sdk/packages/perpetuals/perpetualsTypes";

import {
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsStopOrderTriggerPriceType,
} from "@sdk/types";

const { PerpetualsOrderUtils } = await import(
	"@sdk/packages/perpetuals/utils/perpetualsOrderUtils"
);

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

type JsonRecord = Record<string, unknown>;

const BASE_URL = "https://sdk.test";

const MARKET_ID = "0xmarket";

const MARKET_ID_2 = "0xmarket-two";

const VAULT_ID = "0xvault";

const ACCOUNT_OBJECT_ID = "0xaccount-object";

const ACCOUNT_CAP_ID = "0xaccount-cap";

const ASSISTANT_CAP_ID = "0xassistant-cap";

const WALLET = "0xwallet";

const RECIPIENT = "0xrecipient";

const USDC = "0x2::usdc::USDC";

const PADDED_EVENT_MARKET_ID =
	"0x0000000000000000000000000000000000000000000000000000000000000abc";

const EMPTY_TRANSACTION_KIND = "AAAA";

const originalFetch = globalThis.fetch;

const originalDateNow = Date.now;

afterEach(() => {
	globalThis.fetch = originalFetch;
	Date.now = originalDateNow;
});

function installJsonFetch(payload: unknown, status = 200): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json" },
			})
		);
	}) as typeof fetch;
	return calls;
}

function requestBody(calls: FetchCall[], index = 0): JsonRecord {
	const body = calls[index]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(body) as JsonRecord;
}

function transactionResponse(extra: JsonRecord = {}): JsonRecord {
	return { txKind: EMPTY_TRANSACTION_KIND, ...extra };
}

function makeApi() {
	const serializedTransactions: (Transaction | undefined)[] = [];
	const api = {
		Transactions: () => ({
			fetchBase64TxKindFromTx: (input: { tx?: Transaction }) => {
				serializedTransactions.push(input.tx);
				return EMPTY_TRANSACTION_KIND;
			},
		}),
	};
	return {
		api: api as unknown as AftermathApi,
		serializedTransactions,
	};
}

function makePosition(
	overrides: Partial<PerpetualsPosition> = {}
): PerpetualsPosition {
	return {
		marketId: MARKET_ID,
		collateral: 400,
		collateralUsd: 800,
		baseAssetAmount: 2.5,
		quoteAssetNotionalAmount: 5000,
		cumFundingRateLong: 0.01,
		cumFundingRateShort: -0.01,
		asksQuantity: 1.25,
		bidsQuantity: 2.5,
		pendingOrders: [
			{
				orderId: 22763282186957586694186n,
				side: PerpetualsOrderSide.Ask,
				currentSize: 3_000_000_000n,
				initialSize: 4_000_000_000n,
				clientOrderId: 77n,
			},
		],
		leverage: 5,
		freeMarginUsd: 200,
		freeCollateral: 100,
		unrealizedFundingsUsd: -3,
		unrealizedPnlUsd: 125,
		entryPrice: 2000,
		liquidationPrice: 1650,
		marginRatio: 0.16,
		...overrides,
	};
}

function makeAccountObject(
	positions: PerpetualsPosition[] = [makePosition()]
): PerpetualsAccountObject {
	return {
		accountId: 9_007_199_254_740_993n,
		totalEquityUsd: 1000,
		availableCollateral: 700,
		availableCollateralUsd: 1400,
		totalUnrealizedFundingsUsd: -3,
		totalUnrealizedPnlUsd: 125,
		positions,
	};
}

function makeDirectCap(): PerpetualsAccountCap {
	return {
		objectId: ACCOUNT_CAP_ID,
		walletAddress: WALLET,
		accountId: 9_007_199_254_740_993n,
		accountObjectId: ACCOUNT_OBJECT_ID,
		collateralCoinType: USDC,
		collateral: 700,
		objectVersion: 11,
		objectDigest: "digest-account-cap",
		isAgent: false,
		accountObjectInitialSharedVersion: 7,
		whitelistedAgentCapIds: [ASSISTANT_CAP_ID],
	};
}

function makeAccount(
	accountCap:
		| PerpetualsAccountCap
		| ReturnType<typeof makeVaultAccountCap> = makeDirectCap(),
	api?: AftermathApi,
	positions?: PerpetualsPosition[]
) {
	return new PerpetualsAccount(
		makeAccountObject(positions),
		accountCap,
		{ baseUrl: BASE_URL },
		api
	);
}

function makeVaultAccountCap() {
	return {
		vaultId: VAULT_ID,
		ownerAddress: WALLET,
		accountId: 9_007_199_254_740_993n,
		accountObjectId: ACCOUNT_OBJECT_ID,
		collateralCoinType: USDC,
	};
}

function makeMarketData(
	overrides: Partial<PerpetualsMarketData> = {}
): PerpetualsMarketData {
	return {
		packageId: "0xperps-package",
		objectId: MARKET_ID,
		collateralCoinType: USDC,
		marketParams: {
			marginRatioInitial: 0.05,
			marginRatioMaintenance: 0.025,
			baseAssetSymbol: "BTC",
			basePriceFeedId: 4,
			collateralPriceFeedId: 5,
			fundingFrequencyMs: 60_000n,
			fundingPeriodMs: 86_400_000n,
			premiumTwapFrequencyMs: 5_000n,
			premiumTwapPeriodMs: 60_000n,
			spreadTwapFrequencyMs: 5_000n,
			spreadTwapPeriodMs: 60_000n,
			makerFee: 0.0002,
			takerFee: 0.0005,
			liquidationFee: 0.01,
			insuranceFundFee: 0.002,
			minOrderUsdValue: 10,
			lotSize: 10_000_000n,
			tickSize: 500_000_000n,
			scalingFactor: 1,
			priorityTakerFee: undefined,
			maxPendingOrders: 100n,
			baseOracleTolerance: 1_000_000n,
			collateralOracleTolerance: 1_000_000n,
			maxOpenInterest: 1_000_000,
			maxOpenInterestThreshold: 800_000,
			maxOpenInterestPositionPercent: 0.1,
		},
		marketState: {
			cumFundingRateLong: 0.012,
			cumFundingRateShort: -0.008,
			fundingLastUpdateTimestamp: 1_700_000_000_000,
			premiumTwap: 0.001,
			premiumTwapLastUpdateTimestamp: 1_700_000_000_000,
			spreadTwap: 0.002,
			spreadTwapLastUpdateTimestamp: 1_700_000_000_000,
			openInterest: 4500,
			feesAccrued: 12.5,
		},
		collateralPrice: 2,
		indexPrice: 2000,
		estimatedFundingRate: 0.014,
		nextFundingTimestampMs: 1_800_000_000_000n,
		...overrides,
	};
}

function makeMarket(
	config: { baseUrl: string } = { baseUrl: BASE_URL },
	api?: AftermathApi
) {
	return new PerpetualsMarket(makeMarketData(), config, api);
}

function makeVaultObject(
	overrides: Partial<PerpetualsVaultObject> = {}
): PerpetualsVaultObject {
	return {
		objectId: VAULT_ID,
		version: 18_446_744_073_709_551_615n,
		metadata: {
			name: "BTC Alpha",
			description: "A deterministic test vault",
			curatorName: "Curator",
			curatorUrl: "https://curator.test",
			curatorLogoUrl: "https://curator.test/logo.png",
			extraFields: { twitter_url: "https://x.test/curator" },
		},
		lpSupply: 10_000_000n,
		idleCollateral: 2_000_000n,
		idleCollateralUsd: 4000,
		tvlUsd: 20_000,
		marketIds: [MARKET_ID],
		parameters: {
			lockPeriodMs: 86_400_000n,
			performanceFeePercentage: 0.2,
			forceWithdrawDelayMs: 172_800_000n,
			collateralPriceFeedStorageId: 7,
			collateralPriceFeedStorageSourceId: 2,
			collateralPriceFeedStorageTolerance: 1_000n,
			maxForceWithdrawMarginRatioTolerance: 0.01,
			scalingFactor: 1,
			maxMarketsInVault: 4n,
			maxPendingOrdersPerPosition: 20n,
			maxTotalDepositedCollateral: 100_000_000n,
			minForceWithdrawValueUsd: 25,
		},
		ownerAddress: WALLET,
		creationTimestamp: 1_700_000_000_000,
		accountId: 9_007_199_254_740_993n,
		accountObjectId: ACCOUNT_OBJECT_ID,
		collateralCoinType: USDC,
		lpCoinType: "0xperps-package::vault::BTC_ALPHA",
		lpCoinDecimals: 6,
		monthlyAprPercentage: 2.5,
		monthlyBoostedAprPercentage: 3.1,
		pausedUntilTimestamp: undefined,
		lastPausedTimestamp: 1_700_000_000_000,
		ownerLockedLpBalance: 100_000n,
		...overrides,
	};
}

function makeVault(
	config: { baseUrl: string } = { baseUrl: BASE_URL },
	api?: AftermathApi,
	overrides: Partial<PerpetualsVaultObject> = {}
) {
	return new PerpetualsVault(makeVaultObject(overrides), config, api);
}

function makeStopOrder(
	overrides: Partial<PerpetualsStopOrderData> = {}
): PerpetualsStopOrderData {
	return {
		objectId: "0xstop",
		orderState: { active: {} },
		marketId: MARKET_ID,
		size: 1_000_000_000n,
		side: PerpetualsOrderSide.Ask,
		slTp: {
			stopLossPrice: 1800,
			triggerPriceType: PerpetualsStopOrderTriggerPriceType.IndexPrice,
		},
		...overrides,
	};
}

function makeWithdrawalRequest(
	overrides: Partial<PerpetualsVaultWithdrawRequest> = {}
): PerpetualsVaultWithdrawRequest {
	return {
		userAddress: WALLET,
		vaultId: VAULT_ID,
		lpAmountIn: 1_000n,
		lpAmountInUsd: 250,
		requestTimestamp: 1_700_000_000_000,
		minCollateralAmountOut: 900n,
		minCollateralAmountOutUsd: 200,
		...overrides,
	};
}

function expectTransactionResponse(response: unknown): void {
	if (
		typeof response !== "object" ||
		response === null ||
		!((response as { tx?: unknown }).tx instanceof Transaction)
	) {
		throw new Error("expected a transaction response object");
	}
}

async function expectTxCall(
	invoke: () => Promise<unknown>,
	path: string,
	expectedBody: JsonRecord
): Promise<void> {
	const calls = installJsonFetch(transactionResponse());
	const response = await invoke();
	expectTransactionResponse(response);
	const actualUrl = calls[0]?.input;
	if (actualUrl !== `${BASE_URL}/api/perpetuals/${path}`) {
		throw new Error(`unexpected transaction URL: ${String(actualUrl)}`);
	}
	const actualBody = requestBody(calls);
	const expectedRequestBody = {
		...expectedBody,
		txKind: EMPTY_TRANSACTION_KIND,
	};
	if (JSON.stringify(actualBody) !== JSON.stringify(expectedRequestBody)) {
		throw new Error(
			`unexpected transaction body: ${JSON.stringify(actualBody)} (expected ${JSON.stringify(expectedRequestBody)})`
		);
	}
}

export {
	ACCOUNT_CAP_ID,
	ACCOUNT_OBJECT_ID,
	ASSISTANT_CAP_ID,
	BASE_URL,
	EMPTY_TRANSACTION_KIND,
	MARKET_ID,
	MARKET_ID_2,
	PADDED_EVENT_MARKET_ID,
	Perpetuals,
	PerpetualsAccount,
	PerpetualsApiCasting,
	PerpetualsMarket,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsOrderUtils,
	PerpetualsStopOrderTriggerPriceType,
	PerpetualsVault,
	RECIPIENT,
	Transaction,
	USDC,
	VAULT_ID,
	WALLET,
	expectTransactionResponse,
	expectTxCall,
	installJsonFetch,
	makeAccount,
	makeAccountObject,
	makeApi,
	makeDirectCap,
	makeMarket,
	makeMarketData,
	makePosition,
	makeStopOrder,
	makeVault,
	makeVaultAccountCap,
	makeVaultObject,
	makeWithdrawalRequest,
	originalDateNow,
	originalFetch,
	requestBody,
	transactionResponse,
};
export type {
	AftermathApi,
	FetchCall,
	JsonRecord,
	PerpetualsAccountCap,
	PerpetualsAccountObject,
	PerpetualsMarketData,
	PerpetualsMarketMetadata,
	PerpetualsOrderData,
	PerpetualsPosition,
	PerpetualsStopOrderData,
	PerpetualsVaultObject,
	PerpetualsVaultWithdrawRequest,
};
