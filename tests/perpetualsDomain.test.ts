import { Transaction } from "@mysten/sui/transactions";
import {
	Perpetuals,
	PerpetualsAccount,
	PerpetualsMarket,
	PerpetualsVault,
} from "../src";
import type { AftermathApi } from "../src/general/providers/aftermathApi";
import { PerpetualsApiCasting } from "../src/packages/perpetuals/api/perpetualsApiCasting";
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
} from "../src/packages/perpetuals/perpetualsTypes";
import {
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsStopOrderTriggerPriceType,
} from "../src/types";

const { PerpetualsOrderUtils } = await import(
	"../src/packages/perpetuals/utils/perpetualsOrderUtils"
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

describe("PerpetualsAccount state and order/margin branches", () => {
	it("exposes direct-account identity, order data, and missing-position behavior", () => {
		const account = makeAccount();
		const position = account.positionForMarketId({ marketId: MARKET_ID });

		expect(position?.baseAssetAmount).toBe(2.5);
		expect(
			account.positionForMarketId({ marketId: MARKET_ID_2 })
		).toBeUndefined();
		expect(account.orderDatas()).toEqual([
			{
				orderId: 22763282186957586694186n,
				currentSize: 3_000_000_000n,
				initialSize: 4_000_000_000n,
				side: PerpetualsOrderSide.Ask,
				marketId: MARKET_ID,
			},
		]);
		expect(account.collateral()).toBe(700);
		expect(account.isVault()).toBe(false);
		expect(account.ownerAddress()).toBe(WALLET);
		expect(account.accountObjectId()).toBe(ACCOUNT_OBJECT_ID);
		expect(account.accountId()).toBe(9_007_199_254_740_993n);
		expect(account.accountCapId()).toBe(ACCOUNT_CAP_ID);
		expect(account.getStopOrdersMessageToSign()).toEqual({
			action: "GET_STOP_ORDERS",
			account_id: "9007199254740993",
			clearing_house_ids: [],
		});
		expect(
			account.getStopOrdersMessageToSign({
				marketIds: [MARKET_ID, MARKET_ID_2],
			})
		).toEqual({
			action: "GET_STOP_ORDERS",
			account_id: "9007199254740993",
			clearing_house_ids: [MARKET_ID, MARKET_ID_2],
		});
	});

	it("distinguishes full, partial, unrelated, and limit-linked SL/TP orders", () => {
		const account = makeAccount();
		const full = makeStopOrder({
			objectId: "0xfull",
			size: 9_223_372_036_854_775_807n,
		});
		const partial = makeStopOrder({ objectId: "0xpartial", size: 2_000_000n });
		const standalone = makeStopOrder({
			objectId: "0xstandalone",
			side: PerpetualsOrderSide.Bid,
			slTp: undefined,
			nonSlTp: {
				stopIndexPrice: 2200,
				triggerIfGeStopIndexPrice: true,
				reduceOnly: true,
				triggerPriceType: PerpetualsStopOrderTriggerPriceType.IndexPrice,
			},
		});
		const wrongSide = makeStopOrder({
			objectId: "0xwrong-side",
			side: PerpetualsOrderSide.Bid,
		});
		const linkedLimit = makeStopOrder({
			objectId: "0xlinked-limit",
			size: 9_223_372_036_854_775_807n,
			limitOrder: {
				price: 2_100_000_000_000n,
				orderType: PerpetualsOrderType.PostOnly,
			},
			slTp: {
				takeProfitPrice: 2100,
				triggerPriceType: PerpetualsStopOrderTriggerPriceType.MarkPrice,
				limitOrderId: 123n,
			},
		});
		const orders = [full, partial, standalone, wrongSide, linkedLimit];

		expect(
			account.slTpStopOrderDatasForPosition({
				marketId: MARKET_ID,
				stopOrderDatas: orders,
			})
		).toEqual({ fullSlTpOrder: full, partialSlTpOrders: [partial] });
		expect(
			account.slTpStopOrderDatasForLimitOrder({
				limitOrderId: 123n,
				stopOrderDatas: orders,
			})
		).toEqual({ fullSlTpOrder: linkedLimit, partialSlTpOrders: undefined });
		expect(
			account
				.slTpStopOrderDatas({ stopOrderDatas: orders })
				?.map((order) => order.objectId)
		).toEqual(["0xfull", "0xpartial", "0xlinked-limit"]);
		expect(
			account
				.nonSlTpStopOrderDatas({ stopOrderDatas: orders })
				?.map((order) => order.objectId)
		).toEqual(["0xstandalone", "0xwrong-side"]);
		expect(
			account
				.nonSlTpStopOrderDatasForPosition({
					marketId: MARKET_ID,
					stopOrderDatas: orders,
				})
				?.map((order) => order.objectId)
		).toEqual(["0xstandalone", "0xwrong-side"]);
		expect(
			account.slTpStopOrderDatasForPosition({
				marketId: MARKET_ID_2,
				stopOrderDatas: orders,
			})
		).toEqual({ fullSlTpOrder: undefined, partialSlTpOrders: undefined });
	});

	it("routes direct and vault account previews and preserves margin errors", async () => {
		const direct = makeAccount();
		const vault = makeAccount(makeVaultAccountCap());
		const previewInputs = {
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			size: 2_000_000_000n,
			reduceOnly: false,
			leverage: 4,
		};
		let calls = installJsonFetch({ error: "maintenance margin" });
		await expect(
			direct.getPlaceMarketOrderPreview(previewInputs as never)
		).resolves.toEqual({
			error: "maintenance margin",
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-market-order`
		);
		expect(requestBody(calls)).toEqual({
			...previewInputs,
			size: "2000000000n",
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: 3,
		});
		await expect(
			vault.getSetLeveragePreview({ marketId: MARKET_ID, leverage: 3 })
		).resolves.toEqual({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: 3,
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vault/previews/set-leverage`
		);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			leverage: 3,
			vaultId: VAULT_ID,
		});

		calls = installJsonFetch({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: -5,
		});
		await expect(
			direct.getEditCollateralPreview({
				marketId: MARKET_ID,
				collateralChange: -5n,
			})
		).resolves.toEqual({
			updatedPosition: { marketId: MARKET_ID },
			collateralChange: -5,
		});
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			collateralChange: "-5n",
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch({ stopOrderDatas: [] });
		await expect(
			direct.getStopOrderDatas({ bytes: "signed-bytes", signature: "sig" })
		).resolves.toEqual({ stopOrderDatas: [] });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/stop-order-datas`
		);
		expect(requestBody(calls)).toEqual({
			bytes: "signed-bytes",
			signature: "sig",
			walletAddress: WALLET,
			marketIds: [],
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch({
			marginHistoryDatas: [],
		});
		await expect(
			direct.getMarginHistory({
				timeframe: "1W",
			})
		).resolves.toEqual({
			marginHistoryDatas: [],
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/margin-history`
		);
		expect(requestBody(calls)).toEqual({
			timeframe: "1W",
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch({ marketIdsToData: {} });
		await expect(
			direct.getCancelOrdersPreview({ marketIdsToData: {} })
		).resolves.toEqual({
			marketIdsToData: {},
		});
		expect(calls).toHaveLength(0);
	});

	it("builds direct-account collateral and order transactions with wire bigints", async () => {
		const { api, serializedTransactions } = makeApi();
		const account = makeAccount(makeDirectCap(), api);
		const sponsor = {
			walletAddress: WALLET,
			bytes: "bytes",
			signature: "signature",
		};

		let calls = installJsonFetch(transactionResponse());
		let response = await account.getDepositCollateralTx({
			depositAmount: 9_007_199_254_740_993n,
			isSponsoredTx: true,
			sponsor,
		});
		expectTransactionResponse(response);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/transactions/deposit-collateral`
		);
		expect(requestBody(calls)).toEqual({
			depositAmount: "9007199254740993n",
			isSponsoredTx: true,
			sponsor,
			walletAddress: WALLET,
			collateralCoinType: USDC,
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(
			transactionResponse({ coinOutArg: { kind: "Result", index: 0 } })
		);
		response = await account.getWithdrawCollateralTx({
			withdrawAmount: 123_456_789_012_345n,
			recipientAddress: RECIPIENT,
			tx: new Transaction(),
		});
		expectTransactionResponse(response);
		expect((response as unknown as { coinOutArg: unknown }).coinOutArg).toEqual(
			{
				kind: "Result",
				index: 0,
			}
		);
		expect(requestBody(calls)).toEqual({
			withdrawAmount: "123456789012345n",
			recipientAddress: RECIPIENT,
			walletAddress: WALLET,
			accountId: "9007199254740993n",
			txKind: EMPTY_TRANSACTION_KIND,
		});
		expect(serializedTransactions).toHaveLength(2);
		expect(serializedTransactions[1]).toBeInstanceOf(Transaction);

		calls = installJsonFetch(transactionResponse());
		response = await account.getTransferCollateralTx({
			transferAmount: 500n,
			toAccountId: 42n,
			toAccountCapId: "0xto-cap",
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toEqual({
			transferAmount: "500n",
			toAccountId: "42n",
			toAccountCapId: "0xto-cap",
			walletAddress: WALLET,
			fromAccountId: "9007199254740993n",
			fromAccountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceMarketOrderTx({
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			size: 2_000_000_000n,
			collateralChange: 100,
			hasPosition: true,
			cancelSlTp: false,
			reduceOnly: false,
			slippage: 0.01,
			leverage: 5,
			slTp: { size: 1_000_000_000n, stopLossPrice: 1800 },
		});
		expectTransactionResponse(response);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/transactions/place-market-order`
		);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			side: 0,
			size: "2000000000n",
			collateralChange: 100,
			hasPosition: true,
			cancelSlTp: false,
			reduceOnly: false,
			slippage: 0.01,
			leverage: 5,
			slTp: { size: "1000000000n", stopLossPrice: 1800 },
			walletAddress: WALLET,
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceLimitOrderTx({
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Ask,
			size: 3_000_000_000n,
			price: 2_100_000_000_000n,
			orderType: PerpetualsOrderType.PostOnly,
			collateralChange: 0,
			hasPosition: true,
			cancelSlTp: true,
			reduceOnly: true,
			expiryTimestamp: 1_800_000_000_000n,
			clientOrderId: 88n,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			side: 1,
			size: "3000000000n",
			price: "2100000000000n",
			orderType: 2,
			collateralChange: 0,
			hasPosition: true,
			cancelSlTp: true,
			reduceOnly: true,
			expiryTimestamp: "1800000000000n",
			clientOrderId: "88n",
			walletAddress: WALLET,
			accountId: "9007199254740993n",
			accountCapId: ACCOUNT_CAP_ID,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceScaleOrderTx({
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			totalSize: 6_000_000_000n,
			startPrice: 2_000_000_000_000n,
			endPrice: 2_100_000_000_000n,
			numberOfOrders: 3,
			orderType: PerpetualsOrderType.Standard,
			collateralChange: 20,
			hasPosition: false,
			reduceOnly: false,
			cancelSlTp: false,
			clientOrderIds: [1n, 2n, 3n],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			totalSize: "6000000000n",
			startPrice: "2000000000000n",
			endPrice: "2100000000000n",
			clientOrderIds: ["1n", "2n", "3n"],
			accountId: "9007199254740993n",
		});
	});

	it("builds cancel, stop, SL/TP, TWAP, leverage, and agent-wallet transactions", async () => {
		const { api } = makeApi();
		const account = makeAccount(makeDirectCap(), api);
		let calls = installJsonFetch(transactionResponse());
		let response = await account.getCancelAndPlaceOrdersTx({
			marketId: MARKET_ID,
			orderIdsToCancel: [11n, 12n],
			ordersToPlace: [
				{ side: PerpetualsOrderSide.Bid, price: 2_000n, size: 3_000n },
			],
			orderType: PerpetualsOrderType.Standard,
			reduceOnly: false,
			hasPosition: true,
		});
		expectTransactionResponse(response);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/transactions/cancel-and-place-orders`
		);
		expect(requestBody(calls)).toMatchObject({
			orderIdsToCancel: ["11n", "12n"],
			ordersToPlace: [{ side: 0, price: "2000n", size: "3000n" }],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCancelOrdersTx({
			marketIdsToData: {
				[MARKET_ID]: {
					orderIds: [11n],
					collateralChange: -4,
				},
			},
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			marketIdsToData: {
				[MARKET_ID]: { orderIds: ["11n"], collateralChange: -4 },
			},
			accountCapId: ACCOUNT_CAP_ID,
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCancelStopOrdersTx({
			stopOrderIds: ["0xstop"],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			stopOrderIds: ["0xstop"],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceStopOrdersTx({
			stopOrders: [
				{
					marketId: MARKET_ID,
					size: 2_000_000_000n,
					side: PerpetualsOrderSide.Ask,
					slTp: {
						stopLossPrice: 1800,
						triggerPriceType: PerpetualsStopOrderTriggerPriceType.IndexPrice,
					},
				},
			] as never,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			stopOrders: [
				{
					marketId: MARKET_ID,
					size: "2000000000n",
					side: 1,
				},
			],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getPlaceSlTpOrdersTx({
			marketId: MARKET_ID,
			size: 1_000_000_000n,
			stopLossPrice: 1800,
			takeProfitPrice: 2200,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			marketId: MARKET_ID,
			positionSide: 0,
			size: "1000000000n",
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCreateTwapOrdersTx({
			twapOrders: [
				{
					marketId: MARKET_ID,
					side: PerpetualsOrderSide.Bid,
					size: 10_000n,
					reduceOnly: false,
					chunksAmount: 4,
					executionGapMs: 1000,
					executionTimeUncertaintyMs: 100,
					timeForRetryMs: 500,
					amountUncertaintyBps: 10,
					maxOneExecutionAmountBps: 2500,
					smallTailMergeThresholdBps: 50,
					maxSlippageBps: 100,
				},
			],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			twapOrders: [expect.objectContaining({ size: "10000n" })],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getEditTwapOrdersTx({
			newTwapOrders: { "0xtwap": { newExecutors: [RECIPIENT] } },
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			newTwapOrders: { "0xtwap": { newExecutors: [RECIPIENT] } },
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getCancelTwapOrdersTx({
			twapOrderIds: ["0xtwap"],
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			twapOrderIds: ["0xtwap"],
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getSetLeverageTx({
			marketId: MARKET_ID,
			leverage: 8,
			collateralChange: 12,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			marketId: MARKET_ID,
			leverage: 8,
			collateralChange: 12,
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getGrantAgentWalletTx({
			recipientAddress: RECIPIENT,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			recipientAddress: RECIPIENT,
			accountId: "9007199254740993n",
		});

		calls = installJsonFetch(transactionResponse());
		response = await account.getRevokeAgentWalletTx({
			accountCapId: ASSISTANT_CAP_ID,
		});
		expectTransactionResponse(response);
		expect(requestBody(calls)).toMatchObject({
			accountCapId: ASSISTANT_CAP_ID,
			accountId: "9007199254740993n",
		});
	});

	it("rejects direct-only account operations for vault-backed accounts", async () => {
		const vaultAccount = makeAccount(makeVaultAccountCap());

		await expect(
			vaultAccount.getDepositCollateralTx({ depositAmount: 1n })
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getWithdrawCollateralTx({ withdrawAmount: 1n })
		).rejects.toThrow("not supported for vaults");
		await expect(
			vaultAccount.getTransferCollateralTx({
				transferAmount: 1n,
				toAccountId: 2n,
			})
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getGrantAgentWalletTx({ recipientAddress: RECIPIENT })
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getRevokeAgentWalletTx({ accountCapId: ASSISTANT_CAP_ID })
		).rejects.toThrow("not supported by vault accounts");
		await expect(
			vaultAccount.getPlaceSlTpOrdersTx({
				marketId: MARKET_ID_2,
				stopLossPrice: 1800,
			})
		).rejects.toThrow("you have no position for this market");

		expect(vaultAccount.isVault()).toBe(true);
		expect(vaultAccount.ownerAddress()).toBe(WALLET);
		expect(() => vaultAccount.accountCapId()).toThrow(
			"not account cap id present on vault owned account"
		);
	});
});

describe("PerpetualsVault", () => {
	it("validates LP metadata, computes withdraw slippage, and exposes account metadata", () => {
		expect(PerpetualsVault.isValidLpCoinName("BTC Alpha")).toBe(true);
		expect(PerpetualsVault.isValidLpCoinName("BTC\u0000Alpha")).toBe(true);
		expect(PerpetualsVault.isValidLpCoinName("BTC Δ")).toBe(false);
		expect(PerpetualsVault.isValidLpCoinTypeSymbol("BTC_ALPHA")).toBe(true);
		expect(PerpetualsVault.isValidLpCoinTypeSymbol("btc_ALPHA")).toBe(false);
		expect(PerpetualsVault.isValidLpCoinTypeSymbol("BTC-ALPHA")).toBe(false);

		expect(
			PerpetualsVault.calcWithdrawRequestSlippage({
				withdrawRequest: makeWithdrawalRequest(),
			})
		).toBe(0.2);
		expect(
			PerpetualsVault.calcWithdrawRequestSlippage({
				withdrawRequest: makeWithdrawalRequest({ lpAmountInUsd: 0 }),
			})
		).toBe(0);

		const vault = makeVault();
		expect(vault.partialVaultCap()).toEqual({
			vaultId: VAULT_ID,
			ownerAddress: WALLET,
			accountId: 9_007_199_254_740_993n,
			accountObjectId: ACCOUNT_OBJECT_ID,
			collateralCoinType: USDC,
		});
		Date.now = () => 1_700_000_000_000;
		expect(vault.isPaused()).toBe(false);
		const paused = makeVault({ baseUrl: BASE_URL }, undefined, {
			pausedUntilTimestamp: 1_700_000_000_001n,
		});
		expect(paused.isPaused()).toBe(true);
	});

	it("builds force-withdraw, owner, and user vault transactions with vault identity", async () => {
		const { api } = makeApi();
		const vault = makeVault({ baseUrl: BASE_URL }, api);

		await expectTxCall(
			() =>
				vault.getProcessForceWithdrawRequestTx({
					walletAddress: WALLET,
					sizesToClose: { [MARKET_ID]: 9_007_199_254_740_993n },
					recipientAddress: RECIPIENT,
				}),
			"vault/transactions/process-force-withdraw-request",
			{
				walletAddress: WALLET,
				sizesToClose: { [MARKET_ID]: "9007199254740993n" },
				recipientAddress: RECIPIENT,
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() => vault.getPauseVaultForForceWithdrawRequestTx({}),
			"vault/transactions/pause-vault-for-force-withdraw-request",
			{ vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getUpdateWithdrawRequestSlippageTx({
					minCollateralAmountOut: 123_456n,
				}),
			"vault/transactions/update-withdraw-request-slippage",
			{ minCollateralAmountOut: "123456n", vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerUpdateForceWithdrawDelayTx({
					forceWithdrawDelayMs: 86_400_000n,
				}),
			"vault/transactions/owner/update-force-withdraw-delay",
			{ forceWithdrawDelayMs: "86400000n", vaultId: VAULT_ID }
		);
		await expectTxCall(
			() => vault.getOwnerUpdateLockPeriodTx({ lockPeriodMs: 43_200_000n }),
			"vault/transactions/owner/update-lock-period",
			{ lockPeriodMs: "43200000n", vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerUpdatePerformanceFeeTx({
					performanceFeePercentage: 0.15,
				}),
			"vault/transactions/owner/update-performance-fee",
			{ performanceFeePercentage: 0.15, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() => vault.getGrantAgentWalletTx({ recipientAddress: RECIPIENT }),
			"vault/transactions/owner/grant-agent-wallet",
			{ recipientAddress: RECIPIENT, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() => vault.getRevokeAgentWalletTx({ accountCapId: ASSISTANT_CAP_ID }),
			"vault/transactions/owner/revoke-agent-wallet",
			{ accountCapId: ASSISTANT_CAP_ID, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerProcessWithdrawRequestsTx({ userAddresses: [WALLET] }),
			"vault/transactions/owner/process-withdraw-requests",
			{ userAddresses: [WALLET], vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getOwnerWithdrawPerformanceFeesTx({
					withdrawAmount: 1_000n,
					recipientAddress: RECIPIENT,
				}),
			"vault/transactions/owner/withdraw-performance-fees",
			{
				withdrawAmount: "1000n",
				recipientAddress: RECIPIENT,
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() =>
				vault.getOwnerWithdrawCollateralTx({
					lpWithdrawAmount: 2_000n,
					minCollateralAmountOut: 1_500n,
				}),
			"vault/transactions/owner/withdraw-collateral",
			{
				lpWithdrawAmount: "2000n",
				minCollateralAmountOut: "1500n",
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() =>
				vault.getOwnerWithdrawLockedLiquidityTx({
					amount: 500n,
					minCollateralAmountOut: 300n,
				}),
			"vault/transactions/owner/withdraw-locked-liquidity",
			{
				amount: "500n",
				minCollateralAmountOut: "300n",
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() =>
				vault.getCreateWithdrawRequestTx({
					walletAddress: WALLET,
					lpWithdrawAmount: 2_000n,
					minCollateralAmountOut: 1_500n,
				}),
			"vault/transactions/create-withdraw-request",
			{
				walletAddress: WALLET,
				lpWithdrawAmount: "2000n",
				minCollateralAmountOut: "1500n",
				vaultId: VAULT_ID,
			}
		);
		await expectTxCall(
			() => vault.getCancelWithdrawRequestTx({ walletAddress: WALLET }),
			"vault/transactions/cancel-withdraw-request",
			{ walletAddress: WALLET, vaultId: VAULT_ID }
		);
		await expectTxCall(
			() =>
				vault.getDepositTx({
					walletAddress: WALLET,
					minLpAmountOut: 900n,
					depositAmount: 1_000_000n,
					isSponsoredTx: true,
				}),
			"vault/transactions/deposit",
			{
				walletAddress: WALLET,
				minLpAmountOut: "900n",
				depositAmount: "1000000n",
				isSponsoredTx: true,
				collateralCoinType: USDC,
				vaultId: VAULT_ID,
			}
		);
	});

	it("fetches vault requests and previews, LP prices, and account objects", async () => {
		const { api } = makeApi();
		const vault = makeVault({ baseUrl: BASE_URL }, api);

		let calls = installJsonFetch({ withdrawRequests: [] });
		await expect(vault.getAllWithdrawRequests()).resolves.toEqual({
			withdrawRequests: [],
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vaults/withdraw-requests`
		);
		expect(requestBody(calls)).toEqual({ vaultIds: [VAULT_ID] });

		calls = installJsonFetch({ collateralAmountOut: 800 });
		await expect(
			vault.getPreviewOwnerWithdrawCollateral({ lpWithdrawAmount: 1_000n })
		).resolves.toEqual({ collateralAmountOut: 800 });
		expect(requestBody(calls)).toEqual({
			lpWithdrawAmount: "1000n",
			vaultId: VAULT_ID,
		});

		calls = installJsonFetch({ lpAmountOut: 1250 });
		await expect(
			vault.getPreviewDeposit({ depositAmount: 2_000n })
		).resolves.toEqual({
			lpAmountOut: 1250,
		});
		expect(requestBody(calls)).toEqual({
			depositAmount: "2000n",
			vaultId: VAULT_ID,
		});

		calls = installJsonFetch({ lpCoinPrices: [1.25] });
		await expect(vault.getLpCoinPrice()).resolves.toBe(1.25);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vaults/lp-coin-prices`
		);
		expect(requestBody(calls)).toEqual({ vaultIds: [VAULT_ID] });

		const accountWire = {
			accountId: "9007199254740993n",
			totalEquityUsd: 1000,
			availableCollateral: 700,
			availableCollateralUsd: 1400,
			totalUnrealizedFundingsUsd: 0,
			totalUnrealizedPnlUsd: 0,
			positions: [],
		};
		calls = installJsonFetch({ accounts: [accountWire] });
		await expect(vault.getAccountObject()).resolves.toEqual({
			account: { ...accountWire, accountId: 9_007_199_254_740_993n },
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/accounts/positions`
		);
		expect(requestBody(calls)).toEqual({ accountIds: ["9007199254740993n"] });

		calls = installJsonFetch({ accounts: [accountWire] });
		const accountResponse = await vault.getAccount();
		expect(accountResponse.account).toBeInstanceOf(PerpetualsAccount);
		expect(accountResponse.account.isVault()).toBe(true);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/accounts/positions`
		);
	});
});

describe("Perpetuals root client", () => {
	it("wraps markets, vaults, and accounts while short-circuiting empty queries", async () => {
		const perps = new Perpetuals({ baseUrl: BASE_URL });
		const marketWire = {
			packageId: "0xpackage",
			objectId: MARKET_ID,
			collateralCoinType: USDC,
			marketParams: {
				marginRatioInitial: 0.05,
				marginRatioMaintenance: 0.025,
				baseAssetSymbol: "BTC",
				lotSize: "10000000n",
				tickSize: "500000000n",
			},
			marketState: {
				cumFundingRateLong: 0,
				cumFundingRateShort: 0,
			},
			collateralPrice: 2,
			indexPrice: 2000,
			estimatedFundingRate: 0,
			nextFundingTimestampMs: "1800000000000n",
		};
		const metadata: PerpetualsMarketMetadata = {
			symbol: "BTC",
			displayName: "Bitcoin",
			category: "Crypto",
			image: "/btc.png",
			collateralSymbol: "USDC",
		};
		let calls = installJsonFetch({
			marketDatas: [{ market: marketWire, metadata }],
		});
		const markets = await perps.getMarkets({ marketIds: [MARKET_ID] });
		expect(markets.markets[0]).toBeInstanceOf(PerpetualsMarket);
		expect(markets.markets[0]?.metadata).toEqual(metadata);
		expect(markets.markets[0]?.marketData.nextFundingTimestampMs).toBe(
			1_800_000_000_000n
		);
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({ markets: [marketWire] });
		const allMarkets = await perps.getAllMarkets({ collateralCoinType: USDC });
		expect(allMarkets.markets).toHaveLength(1);
		expect(allMarkets.markets[0]?.marketId).toBe(MARKET_ID);
		expect(requestBody(calls)).toEqual({ collateralCoinType: USDC });

		const vaultWire = {
			...makeVaultObject(),
			version: "18446744073709551615n",
			lpSupply: "10000000n",
			idleCollateral: "2000000n",
			marketIds: [MARKET_ID],
			accountId: "9007199254740993n",
			pausedUntilTimestamp: null,
			ownerLockedLpBalance: "100000n",
			parameters: {
				...makeVaultObject().parameters,
				lockPeriodMs: "86400000n",
				forceWithdrawDelayMs: "172800000n",
				collateralPriceFeedStorageTolerance: "1000n",
				maxMarketsInVault: "4n",
				maxPendingOrdersPerPosition: "20n",
				maxTotalDepositedCollateral: "100000000n",
			},
		};
		calls = installJsonFetch({ vaults: [vaultWire] });
		const vaults = await perps.getVaults({ vaultIds: [VAULT_ID] });
		expect(vaults.vaults[0]).toBeInstanceOf(PerpetualsVault);
		expect(vaults.vaults[0]?.vaultObject.accountId).toBe(
			9_007_199_254_740_993n
		);
		expect(requestBody(calls)).toEqual({ vaultIds: [VAULT_ID] });

		const directCap = makeDirectCap();
		const accountWire = {
			accountId: "9007199254740993n",
			totalEquityUsd: 1000,
			availableCollateral: 700,
			availableCollateralUsd: 1400,
			totalUnrealizedFundingsUsd: 0,
			totalUnrealizedPnlUsd: 0,
			positions: [],
		};
		calls = installJsonFetch({ accounts: [accountWire] });
		const accounts = await perps.getAccounts({ accountCaps: [directCap] });
		expect(accounts.accounts[0]).toBeInstanceOf(PerpetualsAccount);
		expect(accounts.accounts[0]?.accountId()).toBe(9_007_199_254_740_993n);
		expect(requestBody(calls)).toEqual({
			accountIds: ["9007199254740993n"],
		});

		const noFetch = installJsonFetch({ unexpected: true });
		await expect(perps.getAccounts({ accountCaps: [] })).resolves.toEqual({
			accounts: [],
		});
		await expect(perps.getAccountObjects({ accountIds: [] })).resolves.toEqual({
			accounts: [],
		});
		await expect(perps.getPrices({ marketIds: [] })).resolves.toEqual({
			marketsPrices: [],
		});
		await expect(perps.getLpCoinPrices({ vaultIds: [] })).resolves.toEqual({
			lpCoinPrices: [],
		});
		expect(noFetch).toHaveLength(0);
	});

	it("builds root account, cap, share, and vault transactions", async () => {
		const { api } = makeApi();
		const perps = new Perpetuals({ baseUrl: BASE_URL }, api);

		await expectTxCall(
			() =>
				perps.getTransferCapTx({
					recipientAddress: RECIPIENT,
					capObjectId: ACCOUNT_CAP_ID,
				}),
			"transactions/transfer-cap",
			{ recipientAddress: RECIPIENT, capObjectId: ACCOUNT_CAP_ID }
		);

		const deferred = {
			accountArg: { kind: "Input", index: 0 },
			sharePolicyArg: { kind: "Input", index: 1 },
			adminCapArg: { kind: "Input", index: 2 },
			collateralCoinType: USDC,
		};
		let calls = installJsonFetch(transactionResponse({ deferred }));
		const createAccount = await perps.getCreateAccountTx({
			walletAddress: WALLET,
			collateralCoinType: USDC,
			deferShare: true,
		});
		expectTransactionResponse(createAccount);
		expect((createAccount as { deferred: unknown }).deferred).toEqual(deferred);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/transactions/create-account`
		);
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			collateralCoinType: USDC,
			deferShare: true,
			txKind: EMPTY_TRANSACTION_KIND,
		});

		await expectTxCall(
			() =>
				perps.getGrantAgentWalletTx({
					recipientAddress: RECIPIENT,
					accountId: 9_007_199_254_740_993n,
				}),
			"account/transactions/grant-agent-wallet",
			{ recipientAddress: RECIPIENT, accountId: "9007199254740993n" }
		);
		await expectTxCall(
			() =>
				perps.getShareAccountTx({
					accountArg: { kind: "Input", index: 0 } as never,
					sharePolicyArg: { kind: "Input", index: 1 } as never,
					adminCapArg: { kind: "Input", index: 2 } as never,
					collateralCoinType: USDC,
				}),
			"account/transactions/share",
			{
				accountArg: { kind: "Input", index: 0 },
				sharePolicyArg: { kind: "Input", index: 1 },
				adminCapArg: { kind: "Input", index: 2 },
				collateralCoinType: USDC,
			}
		);

		calls = installJsonFetch(transactionResponse());
		const cap = await perps.getCreateVaultCapTx({
			walletAddress: WALLET,
			lpCoinMetadata: {
				name: "BTC Alpha",
				symbol: "BTC_ALPHA",
				description: "Vault LP",
			},
		});
		expectTransactionResponse(cap);
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/vault/transactions/create-vault-cap`
		);
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			lpCoinMetadata: {
				name: "BTC Alpha",
				symbol: "BTC_ALPHA",
				description: "Vault LP",
			},
		});

		await expectTxCall(
			() =>
				perps.getCreateVaultTx({
					walletAddress: WALLET,
					metadata: { name: "BTC Alpha", description: "Vault LP" },
					coinMetadataId: "0xcoin-metadata",
					treasuryCapId: "0xtreasury-cap",
					collateralCoinType: USDC,
					lockPeriodMs: 86_400_000n,
					performanceFeePercentage: 0.2,
					forceWithdrawDelayMs: 172_800_000n,
					initialDepositAmount: 1_000_000n,
				}),
			"vault/transactions/create-vault",
			{
				walletAddress: WALLET,
				metadata: { name: "BTC Alpha", description: "Vault LP" },
				coinMetadataId: "0xcoin-metadata",
				treasuryCapId: "0xtreasury-cap",
				collateralCoinType: USDC,
				lockPeriodMs: "86400000n",
				performanceFeePercentage: 0.2,
				forceWithdrawDelayMs: "172800000n",
				initialDepositAmount: "1000000n",
			}
		);
	});
});

describe("PerpetualsApiCasting order, margin, and liquidation branches", () => {
	function event(parsedJson: unknown, type = "0xperps::events::Test") {
		return {
			parsedJson,
			timestampMs: "1700000000123",
			id: { txDigest: "digest-event" },
			type,
		} as never;
	}

	it("casts liquidation and funding values from fixed wire integers", () => {
		const liquidation = PerpetualsApiCasting.liquidatedEventFromOnChain(
			event({
				ch_id: "0xabc",
				liqee_account_id: "9007199254740993",
				liqor_account_id: "42",
				is_liqee_long: true,
				base_liquidated: "2500000000000000000",
				quote_liquidated: "5000000000000000000000",
				liqee_pnl: "1500000000000000000",
				liquidation_fees: "200000000000000000",
				force_cancel_fees: "100000000000000000",
				insurance_fund_fees: "50000000000000000",
				bad_debt: "0",
			})
		);
		expect(liquidation).toMatchObject({
			accountId: 9_007_199_254_740_993n,
			liqorAccountId: 42n,
			marketId: PADDED_EVENT_MARKET_ID,
			baseLiquidated: 2.5,
			quoteLiquidated: 5000,
			liqeePnlUsd: 1.5,
			liquidationFeesUsd: 0.2,
			insuranceFundFeesUsd: 0.05,
			collateralDeltaUsd: 1.15,
			side: PerpetualsOrderSide.Bid,
			timestamp: 1_700_000_000_123,
		});

		const funding = PerpetualsApiCasting.settledFundingEventFromOnChain(
			event({
				account_id: "9007199254740993",
				ch_id: "0xabc",
				collateral_change_usd: "-125000000000000000",
				mkt_funding_rate_long: "10000000000000000",
				mkt_funding_rate_short: "-20000000000000000",
			})
		);
		expect(funding).toMatchObject({
			accountId: 9_007_199_254_740_993n,
			marketId: PADDED_EVENT_MARKET_ID,
			collateralDeltaUsd: -0.125,
			marketFundingRateLong: 0.01,
			marketFundingRateShort: -0.02,
		});
	});

	it("casts order side, expiry, fill completion, and taker margin deltas", () => {
		const askOrderId = "22763282186957586694186";
		const posted = PerpetualsApiCasting.postedOrderEventFromOnChain(
			event({
				ch_id: "0xabc",
				account_id: "7",
				order_id: askOrderId,
				order_size: "3000000000",
				reduce_only: true,
				expiration_timestamp_ms: null,
			})
		);
		expect(posted).toMatchObject({
			accountId: 7n,
			orderId: 22763282186957586694186n,
			side: PerpetualsOrderSide.Ask,
			size: 3_000_000_000n,
			reduceOnly: true,
			expiryTimestamp: undefined,
		});

		const filled = PerpetualsApiCasting.filledMakerOrdersEventFromOnChain(
			event({
				events: [
					{
						ch_id: "0xabc",
						maker_account_id: "7",
						taker_account_id: "8",
						fees: "10000000000000000",
						filled_size: "2000000000",
						order_id: askOrderId,
						pnl: "500000000000000000",
						remaining_size: "0",
						canceled_size: "0",
					},
					{
						ch_id: "0xabc",
						maker_account_id: "9",
						taker_account_id: "8",
						fees: "0",
						filled_size: "1000000000",
						order_id: "340282366920938440681645676400471965738",
						pnl: "0",
						remaining_size: "1000000000",
						canceled_size: "0",
					},
				],
			})
		);
		expect(filled.events).toEqual([
			expect.objectContaining({
				accountId: 7n,
				takerAccountId: 8n,
				orderId: 22763282186957586694186n,
				side: PerpetualsOrderSide.Ask,
				dropped: true,
				sizeRemaining: 0n,
				collateralDeltaUsd: 0.49,
			}),
			expect.objectContaining({
				accountId: 9n,
				side: PerpetualsOrderSide.Bid,
				dropped: false,
				sizeRemaining: 1_000_000_000n,
			}),
		]);

		const taker = PerpetualsApiCasting.filledTakerOrderEventFromOnChain(
			event({
				ch_id: "0xabc",
				taker_account_id: "7",
				taker_pnl: "500000000000000000",
				taker_fees: "100000000000000000",
				base_asset_delta_ask: "1000000000000000000",
				quote_asset_delta_ask: "500000000000000000000",
				base_asset_delta_bid: "3000000000000000000",
				quote_asset_delta_bid: "4500000000000000000000",
			})
		);
		expect(taker).toMatchObject({
			accountId: 7n,
			baseAssetDelta: 2,
			quoteAssetDelta: 4000,
			collateralDeltaUsd: 0.4,
			side: PerpetualsOrderSide.Bid,
		});
	});
});

describe("PerpetualsOrderUtils and pure protocol helpers", () => {
	it("encodes and decodes ask and bid order ids without losing bigint precision", () => {
		const ask = PerpetualsOrderUtils.orderId(
			1234n,
			42n,
			PerpetualsOrderSide.Ask
		);
		const bid = PerpetualsOrderUtils.orderId(
			1234n,
			42n,
			PerpetualsOrderSide.Bid
		);

		expect(ask).toBe(0x4d2000000000000002an);
		expect(bid).toBe(0xfffffffffffffb2d000000000000002an);
		expect(PerpetualsOrderUtils.isAsk(ask)).toBe(true);
		expect(PerpetualsOrderUtils.isAsk(bid)).toBe(false);
		expect(PerpetualsOrderUtils.price(ask)).toBe(1234n);
		expect(PerpetualsOrderUtils.price(bid)).toBe(1234n);
		expect(PerpetualsOrderUtils.counter(42n)).toBe(42n);
		expect(Perpetuals.orderIdToSide(ask)).toBe(PerpetualsOrderSide.Ask);
		expect(Perpetuals.orderIdToSide(bid)).toBe(PerpetualsOrderSide.Bid);
	});

	it("converts fixed prices and sizes at the documented nine-decimal boundary", () => {
		expect(Perpetuals.priceToOrderPrice({ price: 12.345_678_901_6 })).toBe(
			12_345_678_902n
		);
		expect(
			Perpetuals.orderPriceToPrice({ orderPrice: 12_345_678_902n })
		).toBeCloseTo(12.345_678_902, 9);
		expect(Perpetuals.lotOrTickSizeToBigInt(0.125)).toBe(125_000_000n);
		expect(Perpetuals.lotOrTickSizeToNumber(125_000_000n)).toBe(0.125);
	});

	it("maps position sides, execution prices, and collateral event types", () => {
		expect(Perpetuals.positionSide({ baseAssetAmount: 3 })).toBe(
			PerpetualsOrderSide.Bid
		);
		expect(Perpetuals.positionSide({ baseAssetAmount: 0 })).toBe(
			PerpetualsOrderSide.Bid
		);
		expect(Perpetuals.positionSide({ baseAssetAmount: -3 })).toBe(
			PerpetualsOrderSide.Ask
		);
		expect(
			Perpetuals.orderPriceFromEvent({
				orderEvent: {
					baseAssetDelta: 2,
					quoteAssetDelta: 4500,
				} as never,
			})
		).toBe(2250);
		expect(
			Perpetuals.eventTypeForCollateral({
				eventType: "0xperps::events::Liquidated",
				collateralCoinType: USDC,
			})
		).toBe("0xperps::events::Liquidated<0x2::usdc::USDC>");
	});
});

describe("PerpetualsMarket", () => {
	it("exposes market metadata, margin ratios, and safe funding timestamps", () => {
		const market = makeMarket();

		expect(market.marketId).toBe(MARKET_ID);
		expect(market.collateralCoinType).toBe(USDC);
		expect(market.lotSize()).toBe(0.01);
		expect(market.tickSize()).toBe(0.5);
		expect(market.maxLeverage()).toBe(20);
		expect(market.initialMarginRatio()).toBe(0.05);
		expect(market.maintenanceMarginRatio()).toBe(0.025);
		expect(market.estimatedFundingRate()).toBe(0.014);
		expect(market.nextFundingTimeMs()).toBe(1_800_000_000_000);

		Date.now = () => 1_799_999_999_000;
		expect(market.timeUntilNextFundingMs()).toBe(1000);

		const capped = makeMarket({ baseUrl: BASE_URL }, undefined);
		capped.marketData = makeMarketData({
			nextFundingTimestampMs: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
		});
		expect(capped.nextFundingTimeMs()).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("calculates remaining-order collateral and handles falsy leverage", () => {
		const market = makeMarket();
		const orderData: PerpetualsOrderData = {
			marketId: MARKET_ID,
			orderId: 1n,
			side: PerpetualsOrderSide.Bid,
			initialSize: 5_000_000_000n,
			currentSize: 3_000_000_000n,
		};

		expect(
			market.calcCollateralUsedForOrder({
				leverage: 4,
				orderData,
				indexPrice: 2000,
				collateralPrice: 2,
			})
		).toEqual({ collateralUsd: 1500, collateral: 750 });
		expect(
			market.calcCollateralUsedForOrder({
				leverage: 0,
				orderData,
				indexPrice: 2000,
				collateralPrice: 2,
			})
		).toEqual({ collateralUsd: 6000, collateral: 3000 });
	});

	it("rounds prices and sizes with floor, ceil, nearest, and bigint outputs", () => {
		const market = makeMarket();

		expect(market.roundToValidPrice({ price: 101.26, floor: true })).toBe(101);
		expect(market.roundToValidPrice({ price: 101.26, ceil: true })).toBe(101.5);
		expect(market.roundToValidPrice({ price: 101.26 })).toBe(101.5);
		expect(market.roundToValidPriceBigInt({ price: 101.26, floor: true })).toBe(
			101_000_000_000n
		);
		expect(market.roundToValidPriceBigInt({ price: 101.26, ceil: true })).toBe(
			101_500_000_000n
		);

		expect(market.roundToValidSize({ size: 1.236, floor: true })).toBe(1.23);
		expect(market.roundToValidSize({ size: 1.236, ceil: true })).toBe(1.24);
		expect(market.roundToValidSize({ size: 1.236 })).toBe(1.24);
		expect(market.roundToValidSizeBigInt({ size: 1.236, floor: true })).toBe(
			1_230_000_000n
		);
		expect(market.roundToValidSizeBigInt({ size: 1.236, ceil: true })).toBe(
			1_240_000_000n
		);
	});

	it("creates a zeroed position carrying current funding rates", () => {
		const market = makeMarket();
		expect(market.emptyPosition()).toEqual({
			marketId: MARKET_ID,
			collateral: 0,
			collateralUsd: 0,
			baseAssetAmount: 0,
			quoteAssetNotionalAmount: 0,
			cumFundingRateLong: 0.012,
			cumFundingRateShort: -0.008,
			asksQuantity: 0,
			bidsQuantity: 0,
			pendingOrders: [],
			leverage: 1,
			entryPrice: 0,
			freeCollateral: 0,
			freeMarginUsd: 0,
			liquidationPrice: 0,
			marginRatio: 1,
			unrealizedFundingsUsd: 0,
			unrealizedPnlUsd: 0,
		});
	});

	it("fetches orderbook and preserves bigint max-order-size responses", async () => {
		const market = makeMarket();
		const orderbook = {
			bids: [{ price: 1999, quantity: 3 }],
			asks: [{ price: 2001, quantity: 4 }],
		};
		let calls = installJsonFetch({ orderbooks: [{ orderbook }] });
		await expect(market.getOrderbook()).resolves.toEqual({ orderbook });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/markets/orderbooks`
		);
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({ maxOrderSize: "9007199254740993n" });
		await expect(
			market.getMaxOrderSize({
				accountId: 9_007_199_254_740_993n,
				side: PerpetualsOrderSide.Bid,
				leverage: 5,
			})
		).resolves.toEqual({ maxOrderSize: 9_007_199_254_740_993n });
		expect(requestBody(calls)).toEqual({
			accountId: "9007199254740993n",
			side: 0,
			leverage: 5,
			marketId: MARKET_ID,
		});
	});

	it("routes market previews and propagates abort signals and error branches", async () => {
		const market = makeMarket();
		const signal = new AbortController().signal;
		const preview = {
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			size: 2_000_000_000n,
			reduceOnly: false,
			leverage: 4,
		};

		let calls = installJsonFetch({ error: "insufficient margin" });
		await expect(
			market.getPlaceMarketOrderPreview(preview as never, signal)
		).resolves.toEqual({ error: "insufficient margin" });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-market-order`
		);
		expect(calls[0]?.init?.signal).toBe(signal);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			side: 0,
			size: "2000000000n",
			reduceOnly: false,
			leverage: 4,
		});

		calls = installJsonFetch({ updatedPosition: { marketId: MARKET_ID } });
		await expect(
			market.getPlaceLimitOrderPreview(preview as never)
		).resolves.toEqual({ updatedPosition: { marketId: MARKET_ID } });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-limit-order`
		);

		calls = installJsonFetch({ updatedPosition: { marketId: MARKET_ID } });
		await expect(
			market.getPlaceScaleOrderPreview({
				...preview,
				totalSize: 4_000_000_000n,
				startPrice: 1_900_000_000_000n,
				endPrice: 2_100_000_000_000n,
				numberOfOrders: 3,
				orderType: PerpetualsOrderType.Standard,
			} as never)
		).resolves.toEqual({ updatedPosition: { marketId: MARKET_ID } });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-scale-order`
		);
	});

	it("fetches market stats, prices, and paginated order history through the root client", async () => {
		const market = makeMarket();
		let calls = installJsonFetch({
			marketsStats: [
				{
					volumeUsd: 10_000,
					volumeBaseAssetAmount: 5,
					priceChange: 10,
					priceChangePercentage: 0.01,
					basePrice: 2000,
					collateralPrice: 2,
					midPrice: 2001,
					markPrice: 2002,
				},
			],
		});
		await expect(market.get24hrStats()).resolves.toMatchObject({
			volumeUsd: 10_000,
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/markets/24hr-stats`
		);
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({
			marketsPrices: [
				{
					marketId: MARKET_ID,
					basePrice: 2000,
					collateralPrice: 2,
					midPrice: undefined,
					markPrice: 2002,
				},
			],
		});
		await expect(market.getPrices()).resolves.toEqual({
			marketId: MARKET_ID,
			basePrice: 2000,
			collateralPrice: 2,
			midPrice: undefined,
			markPrice: 2002,
		});
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({
			orders: [{ orderId: "1n" }],
			nextBeforeTimestampCursor: 1_699_999_999_000,
		});
		await expect(
			market.getOrderHistory({
				beforeTimestampCursor: 1_700_000_000_000,
				limit: 25,
			})
		).resolves.toEqual({
			orders: [{ orderId: 1n }],
			nextBeforeTimestampCursor: 1_699_999_999_000,
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/market/order-history`
		);
		expect(requestBody(calls)).toEqual({
			beforeTimestampCursor: 1_700_000_000_000,
			limit: 25,
			marketId: MARKET_ID,
		});
	});
});
