import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

// The root client constructs these wrappers after the HTTP boundary. Keeping
// them small makes this slice assert the root endpoint contract directly.
jest.mock("../src/packages/perpetuals/perpetualsAccount", () => ({
	PerpetualsAccount: class {
		public readonly account: unknown;
		public readonly accountCap: unknown;

		public constructor(account: unknown, accountCap: unknown) {
			this.account = account;
			this.accountCap = accountCap;
		}
	},
}));

jest.mock("../src/packages/perpetuals/perpetualsMarket", () => ({
	PerpetualsMarket: class {
		public readonly marketData: unknown;
		public readonly metadata: unknown;

		public constructor(
			marketData: unknown,
			_config?: unknown,
			_api?: unknown,
			metadata?: unknown
		) {
			this.marketData = marketData;
			this.metadata = metadata;
		}
	},
}));

jest.mock("../src/packages/perpetuals/perpetualsVault", () => ({
	PerpetualsVault: class {
		public readonly vaultObject: unknown;

		public constructor(vaultObject: unknown) {
			this.vaultObject = vaultObject;
		}
	},
}));

import type { EventOnChain } from "../src/general/types/castingTypes";
import {
	AftermathTransportError,
	isAftermathTransportError,
} from "../src/general/utils/transportError";
import type { Perpetuals } from "../src/packages/perpetuals/perpetuals";
import {
	PerpetualsOrderSide,
	PerpetualsStopOrderType,
} from "../src/packages/perpetuals/perpetualsTypes";

// The root barrel establishes the SDK's legacy static helper graph. Load it
// first, then load the leaf classes dynamically so ESM evaluates the cycle in
// a stable order.
await import("../src");
const { PerpetualsApi } = await import(
	"../src/packages/perpetuals/api/perpetualsApi"
);
const { PerpetualsApiCasting } = await import(
	"../src/packages/perpetuals/api/perpetualsApiCasting"
);
const { Perpetuals: PerpetualsClient } = await import(
	"../src/packages/perpetuals/perpetuals"
);
const { Transaction } = await import("@mysten/sui/transactions");

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

type FetchHandler = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const originalFetch = globalThis.fetch;

const API_BASE_URL = "https://sdk.test/";
const EVENT_PACKAGE =
	"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const EVENT_TYPE = `${EVENT_PACKAGE}::events::TestEvent`;
const TX_DIGEST = "7f3b9c-event-digest";
const EVENT_TIMESTAMP = 1_700_000_000_123;
const SHORT_ID = "0x1";
const FULL_ID =
	"0x0000000000000000000000000000000000000000000000000000000000000001";
const SHORT_ADDRESS = "0x2";
const FULL_ADDRESS =
	"0x0000000000000000000000000000000000000000000000000000000000000002";
const COLLATERAL = "0x2::sui::SUI";
const ACCOUNT_ID = 9_007_199_254_740_993_123n;
const ACCOUNT_ID_ON_CHAIN = "9007199254740993123";
const ACCOUNT_ID_WIRE = "9007199254740993123n";
const BID_ORDER_ID = 170141183460469231731687303715884105728n;
const BID_ORDER_ID_WIRE = "170141183460469231731687303715884105728";
const MALFORMED_COLLECTION_REGEX = /undefined|map/;

beforeEach(() => {
	jest
		.spyOn(Transaction, "from")
		.mockImplementation((txKind) => ({ mode: "from", txKind }) as never);
	jest
		.spyOn(Transaction, "fromKind")
		.mockImplementation((txKind) => ({ mode: "fromKind", txKind }) as never);
});

function installFetch(
	body: unknown,
	status = 200,
	headers?: HeadersInit
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		const responseBody =
			typeof body === "string" ? body : JSON.stringify(body ?? null);
		return Promise.resolve(
			new Response(responseBody, {
				status,
				headers,
			})
		);
	}) as typeof fetch;
	return calls;
}

function installFetchHandler(handler: FetchHandler): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(handler(input, init));
	}) as typeof fetch;
	return calls;
}

function requestBody(call: FetchCall): unknown {
	if (typeof call.init?.body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(call.init.body);
}

async function expectPost(
	run: (client: Perpetuals) => Promise<unknown>,
	response: unknown,
	path: string,
	expectedBody: unknown
): Promise<unknown> {
	const calls = installFetch(response);
	const result = await run(new PerpetualsClient({ baseUrl: API_BASE_URL }));

	expect(calls).toHaveLength(1);
	expect(calls[0]?.input).toBe(`https://sdk.test/api/perpetuals/${path}`);
	expect(calls[0]?.init?.method).toBe("POST");
	expect(calls[0]?.init?.headers).toEqual({
		"Content-Type": "application/json",
	});
	expect(requestBody(calls[0] as FetchCall)).toEqual(expectedBody);

	return result;
}

function onChainEvent<Fields>(
	parsedJson: Fields,
	type = EVENT_TYPE
): EventOnChain<Fields> {
	return {
		id: { txDigest: TX_DIGEST, eventSeq: "0" },
		packageId: EVENT_PACKAGE,
		transactionModule: "events",
		sender: FULL_ADDRESS,
		type,
		parsedJson,
		bcs: "",
		timestampMs: String(EVENT_TIMESTAMP),
	};
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

describe("PerpetualsApi metadata seam", () => {
	const addresses = {
		packages: { events: EVENT_PACKAGE },
		objects: { registry: FULL_ID },
	};

	it("requires configured perpetuals addresses", () => {
		expect(
			() =>
				new PerpetualsApi({
					addresses: {},
				} as never)
		).toThrow("not all required addresses have been set in provider");
	});

	it("builds all event type selectors and account capability types", () => {
		const api = new PerpetualsApi({
			addresses: { perpetuals: addresses },
		} as never);
		const event = (name: string) => `${EVENT_PACKAGE}::events::${name}`;

		expect(api.addresses).toEqual(addresses);
		expect(api.moveErrors).toEqual({});
		expect(api.eventTypes).toEqual({
			withdrewCollateral: event("WithdrewCollateral"),
			depositedCollateral: event("DepositedCollateral"),
			settledFunding: event("SettledFunding"),
			allocatedCollateral: event("AllocatedCollateral"),
			deallocatedCollateral: event("DeallocatedCollateral"),
			liquidated: event("LiquidatedPosition"),
			filledTakerOrderLiquidator: event("FilledTakerOrderLiquidator"),
			performedLiquidation: event("PerformedLiquidation"),
			createdAccount: event("CreatedAccount"),
			canceledOrder: event("CanceledOrder"),
			filledMakerOrders: event("FilledMakerOrders"),
			filledMakerOrder: event("FilledMakerOrder"),
			filledTakerOrder: event("FilledTakerOrder"),
			reducedOrder: event("ReducedOrder"),
			postedOrder: event("PostedOrder"),
			updatedPremiumTwap: event("UpdatedPremiumTwap"),
			updatedSpreadTwap: event("UpdatedSpreadTwap"),
			updatedFunding: event("UpdatedFunding"),
			updatedMarketVersion: event("UpdatedClearingHouseVersion"),
			createdStopOrderTicket: event("CreatedStopOrderTicket"),
			deletedStopOrderTicket: event("DeletedStopOrderTicket"),
			editedStopOrderTicketExecutor: event("EditedStopOrderTicketExecutor"),
			addedStopOrderTicketCollateral: event("AddedStopOrderTicketCollateral"),
			removedStopOrderTicketCollateral: event(
				"RemovedStopOrderTicketCollateral"
			),
			editedStopOrderTicketDetails: event("EditedStopOrderTicketDetails"),
			executedStopOrderTicket: event("ExecutedStopOrderTicket"),
			performedAdl: event("PerformedADL"),
		});
		expect(api.getAccountCapType({ collateralCoinType: COLLATERAL })).toBe(
			`${EVENT_PACKAGE}::account::Account<${COLLATERAL}>`
		);
	});
});

describe("PerpetualsApiCasting event boundary", () => {
	it("casts market version and collateral events with bigint fields", () => {
		expect(
			PerpetualsApiCasting.UpdatedMarketVersionEventFromOnChain(
				onChainEvent({ ch_id: SHORT_ID, version: "18446744073709551615" })
			)
		).toEqual({
			marketId: FULL_ID,
			version: 18446744073709551615n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.withdrewCollateralEventFromOnChain(
				onChainEvent({
					account_id: ACCOUNT_ID_ON_CHAIN,
					collateral: "12345678901234567890",
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			collateralDelta: 12345678901234567890n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.depositedCollateralEventFromOnChain(
				onChainEvent({ account_id: "42", collateral: "98765432109876543210" })
			)
		).toEqual({
			accountId: 42n,
			collateralDelta: 98765432109876543210n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts funding settlement and allocation events to public values", () => {
		expect(
			PerpetualsApiCasting.settledFundingEventFromOnChain(
				onChainEvent({
					account_id: ACCOUNT_ID_ON_CHAIN,
					ch_id: SHORT_ID,
					collateral_change_usd: "3000000000000000000",
					mkt_funding_rate_long: "250000000000000000",
					mkt_funding_rate_short: "500000000000000000",
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			collateralDeltaUsd: 3,
			marketId: FULL_ID,
			marketFundingRateLong: 0.25,
			marketFundingRateShort: 0.5,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.allocatedCollateralEventFromOnChain(
				onChainEvent({
					account_id: "7",
					ch_id: SHORT_ID,
					collateral: "1000000000000000001",
				})
			)
		).toEqual({
			accountId: 7n,
			marketId: FULL_ID,
			collateralDelta: 1000000000000000001n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.deallocatedCollateralEventFromOnChain(
				onChainEvent({
					account_id: "8",
					ch_id: SHORT_ID,
					collateral: "2",
				})
			)
		).toEqual({
			accountId: 8n,
			marketId: FULL_ID,
			collateralDelta: 2n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts liquidation events, including long and short side branches", () => {
		const fields = {
			ch_id: SHORT_ID,
			liqee_account_id: ACCOUNT_ID_ON_CHAIN,
			liqor_account_id: "17",
			is_liqee_long: true,
			base_liquidated: "2000000000000000000",
			quote_liquidated: "30000000000000000000",
			liqee_pnl: "10000000000000000000",
			liquidation_fees: "1000000000000000000",
			force_cancel_fees: "500000000000000000",
			insurance_fund_fees: "250000000000000000",
			bad_debt: "0",
		};
		expect(
			PerpetualsApiCasting.liquidatedEventFromOnChain(onChainEvent(fields))
		).toEqual({
			accountId: ACCOUNT_ID,
			collateralDeltaUsd: 8.25,
			liqorAccountId: 17n,
			marketId: FULL_ID,
			baseLiquidated: 2,
			quoteLiquidated: 30,
			liqeePnlUsd: 10,
			liquidationFeesUsd: 1,
			insuranceFundFeesUsd: 0.25,
			side: PerpetualsOrderSide.Bid,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.liquidatedEventFromOnChain(
				onChainEvent({ ...fields, is_liqee_long: false })
			)
		).toMatchObject({ side: PerpetualsOrderSide.Ask });
	});

	it("casts account and margin-ratio events", () => {
		expect(
			PerpetualsApiCasting.createdAccountEventFromOnChain(
				onChainEvent({ user: SHORT_ADDRESS, account_id: ACCOUNT_ID_ON_CHAIN })
			)
		).toEqual({
			user: FULL_ADDRESS,
			accountId: ACCOUNT_ID,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.SetPositionInitialMarginRatioEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					initial_margin_ratio: "125000000000000000",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			accountId: ACCOUNT_ID,
			initialMarginRatio: 0.125,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts order events and derives side, fill, and drop metadata", () => {
		expect(
			PerpetualsApiCasting.canceledOrderEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					size: "12345678901234567890",
					order_id: "1",
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			marketId: FULL_ID,
			side: PerpetualsOrderSide.Ask,
			size: 12345678901234567890n,
			orderId: 1n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.filledMakerOrdersEventFromOnChain(
				onChainEvent({
					events: [
						{
							ch_id: SHORT_ID,
							maker_account_id: "1",
							taker_account_id: "2",
							fees: "750000000000000000",
							filled_size: "12345678901234567890",
							order_id: BID_ORDER_ID_WIRE,
							pnl: "5000000000000000000",
							remaining_size: "0",
							canceled_size: "3",
						},
					],
				})
			)
		).toEqual({
			events: [
				{
					accountId: 1n,
					takerAccountId: 2n,
					collateralDeltaUsd: 4.25,
					pnlUsd: 5,
					feesUsd: 0.75,
					marketId: FULL_ID,
					orderId: BID_ORDER_ID,
					side: PerpetualsOrderSide.Bid,
					size: 12345678901234567890n,
					dropped: true,
					sizeRemaining: 0n,
					canceledSize: 3n,
				},
			],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts taker fills with both derived position sides", () => {
		const base = {
			ch_id: SHORT_ID,
			taker_account_id: ACCOUNT_ID_ON_CHAIN,
			taker_pnl: "2000000000000000000",
			taker_fees: "500000000000000000",
			base_asset_delta_bid: "3000000000000000000",
			quote_asset_delta_bid: "10000000000000000000",
			base_asset_delta_ask: "1000000000000000000",
			quote_asset_delta_ask: "2000000000000000000",
		};
		const bid = PerpetualsApiCasting.filledTakerOrderEventFromOnChain(
			onChainEvent(base)
		);
		expect(bid).toEqual({
			baseAssetDelta: 2,
			accountId: ACCOUNT_ID,
			collateralDeltaUsd: 1.5,
			takerPnlUsd: 2,
			takerFeesUsd: 0.5,
			marketId: FULL_ID,
			side: PerpetualsOrderSide.Bid,
			quoteAssetDelta: 8,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		const ask = PerpetualsApiCasting.filledTakerOrderEventFromOnChain(
			onChainEvent({
				...base,
				base_asset_delta_bid: "1000000000000000000",
				base_asset_delta_ask: "3000000000000000000",
			})
		);
		expect(ask.side).toBe(PerpetualsOrderSide.Ask);
		expect(ask.baseAssetDelta).toBe(-2);
	});

	it("preserves optional posted-order expiration semantics", () => {
		const common = {
			ch_id: SHORT_ID,
			account_id: ACCOUNT_ID_ON_CHAIN,
			order_id: "1",
			order_size: "90",
			reduce_only: false,
		};
		const withoutExpiry = PerpetualsApiCasting.postedOrderEventFromOnChain(
			onChainEvent({ ...common, expiration_timestamp_ms: null })
		);
		const withExpiry = PerpetualsApiCasting.postedOrderEventFromOnChain(
			onChainEvent({ ...common, expiration_timestamp_ms: "1700000000999" })
		);

		expect(withoutExpiry).toMatchObject({
			accountId: ACCOUNT_ID,
			marketId: FULL_ID,
			size: 90n,
			orderId: 1n,
			side: PerpetualsOrderSide.Ask,
			reduceOnly: false,
		});
		expect(withoutExpiry.expiryTimestamp).toBeUndefined();
		expect(withExpiry.expiryTimestamp).toBe(1700000000999n);

		expect(
			PerpetualsApiCasting.reducedOrderEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					size_change: "12345678901234567890",
					order_id: BID_ORDER_ID_WIRE,
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			marketId: FULL_ID,
			sizeChange: 12345678901234567890n,
			orderId: BID_ORDER_ID,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts stop-order ticket lifecycle events and optional subaccounts", () => {
		expect(
			PerpetualsApiCasting.createdStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: null,
					executors: [SHORT_ADDRESS],
					gas: "12345678901234567890",
					stop_order_type: "1",
					encrypted_details: [0, 255],
				})
			)
		).toEqual({
			ticketId: FULL_ID,
			accountId: ACCOUNT_ID,
			executors: [FULL_ADDRESS],
			gas: 12345678901234567890n,
			stopOrderType: PerpetualsStopOrderType.Standalone,
			encryptedDetails: [0, 255],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.executedStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					executor: SHORT_ADDRESS,
				})
			)
		).toEqual({
			ticketId: FULL_ID,
			executor: FULL_ADDRESS,
			accountId: ACCOUNT_ID,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		const deletedWithoutSubaccount =
			PerpetualsApiCasting.deletedStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: null,
					executor: SHORT_ADDRESS,
				})
			);
		const deletedWithSubaccount =
			PerpetualsApiCasting.deletedStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: SHORT_ID,
					executor: SHORT_ADDRESS,
				})
			);
		expect(deletedWithoutSubaccount.subAccountId).toBeUndefined();
		expect(deletedWithSubaccount.subAccountId).toBe(FULL_ID);
	});

	it("casts edited stop-order details and executor sets", () => {
		const details =
			PerpetualsApiCasting.editedStopOrderTicketDetailsEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: SHORT_ID,
					stop_order_type: "0",
					encrypted_details: [1, 2, 3],
				})
			);
		expect(details).toEqual({
			ticketId: FULL_ID,
			stopOrderType: PerpetualsStopOrderType.SlTp,
			accountId: ACCOUNT_ID,
			subAccountId: FULL_ID,
			encryptedDetails: [1, 2, 3],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		const executors =
			PerpetualsApiCasting.editedStopOrderTicketExecutorEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: null,
					executors: [SHORT_ADDRESS, FULL_ADDRESS],
				})
			);
		expect(executors).toEqual({
			ticketId: FULL_ID,
			accountId: ACCOUNT_ID,
			subAccountId: undefined,
			executors: [FULL_ADDRESS, FULL_ADDRESS],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts premium, spread, and cumulative funding TWAP events", () => {
		expect(
			PerpetualsApiCasting.updatedPremiumTwapEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					index_price: "100000000000000000000",
					book_price: "101000000000000000000",
					premium_twap: "2500000000000000000",
					premium_twap_last_upd_ms: "1700000000999",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			indexPrice: 100,
			bookPrice: 101,
			premiumTwap: 2.5,
			premiumTwapLastUpdateMs: 1_700_000_000_999,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.updatedSpreadTwapEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					book_price: "101000000000000000000",
					index_price: "100000000000000000000",
					spread_twap: "1000000000000000000",
					spread_twap_last_upd_ms: "1700000001000",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			bookPrice: 101,
			indexPrice: 100,
			spreadTwap: 1,
			spreadTwapLastUpdateMs: 1_700_000_001_000,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.updatedFundingEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					cum_funding_rate_long: "125000000000000000",
					cum_funding_rate_short: "250000000000000000",
					funding_last_upd_ms: "1700000002000",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			cumFundingRateLong: 0.125,
			cumFundingRateShort: 0.25,
			fundingLastUpdateMs: 1_700_000_002_000,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});
});

describe("Perpetuals HTTP fetch wrappers", () => {
	it("posts all-markets and wraps bigint market data", async () => {
		const result = (await expectPost(
			(client) => client.getAllMarkets({ collateralCoinType: COLLATERAL }),
			{
				markets: [
					{
						objectId: SHORT_ID,
						nextFundingTimestampMs: "18446744073709551615n",
					},
				],
			},
			"all-markets",
			{ collateralCoinType: COLLATERAL }
		)) as { markets: Array<{ marketData: Record<string, unknown> }> };

		expect(result.markets[0]?.marketData).toEqual({
			objectId: SHORT_ID,
			nextFundingTimestampMs: 18446744073709551615n,
		});
	});

	it("posts markets and preserves optional market metadata", async () => {
		const result = (await expectPost(
			(client) => client.getMarkets({ marketIds: [SHORT_ID, FULL_ID] }),
			{
				marketDatas: [
					{
						market: { objectId: SHORT_ID },
						metadata: null,
					},
				],
			},
			"markets",
			{ marketIds: [SHORT_ID, FULL_ID] }
		)) as { markets: Array<{ marketData: unknown; metadata: unknown }> };

		expect(result.markets[0]?.marketData).toEqual({ objectId: SHORT_ID });
		expect(
			result.markets[0]?.metadata === null ||
				result.markets[0]?.metadata === undefined
		).toBe(true);
	});

	it("uses the markets endpoint for the single-market convenience wrapper", async () => {
		const result = (await expectPost(
			(client) => client.getMarket({ marketId: SHORT_ID }),
			{ marketDatas: [{ market: { objectId: SHORT_ID } }] },
			"markets",
			{ marketIds: [SHORT_ID] }
		)) as { market: { marketData: { objectId: string } } };

		expect(result.market.marketData.objectId).toBe(SHORT_ID);
	});

	it("fetches vault config with an empty POST body and casts bigint limits", async () => {
		const result = await expectPost(
			(client) => client.getVaultsConfig(),
			{
				id: SHORT_ID,
				version: "18446744073709551615n",
				collateralPriceFeedStorageToleranceMs: "30000n",
				maxLockPeriodMs: "5184000000n",
				maxForceWithdrawDelayMs: "86400000n",
				maxPerformanceFeePercentage: 0.2,
				minOwnerLockUsd: 1,
				maxOwnerLockUsd: 1_000_000,
				minDepositUsd: 1,
				maxMarketsInVault: "12n",
				maxPendingOrdersPerPosition: "70n",
				forceWithdrawPauseMs: "300000n",
				maxAssistantsPerVault: "10n",
			},
			"vaults/config",
			{}
		);

		expect(result).toMatchObject({
			version: 18446744073709551615n,
			maxMarketsInVault: 12n,
			maxAssistantsPerVault: 10n,
		});
	});

	it("routes all-vault and selected-vault requests", async () => {
		const all = (await expectPost(
			(client) => client.getAllVaults(),
			{ vaults: [{ objectId: SHORT_ID, version: "9n" }] },
			"vaults",
			{}
		)) as { vaults: Array<{ vaultObject: Record<string, unknown> }> };
		expect(all.vaults[0]?.vaultObject.version).toBe(9n);

		const selected = (await expectPost(
			(client) => client.getVaults({ vaultIds: [SHORT_ID, FULL_ID] }),
			{ vaults: [{ objectId: SHORT_ID }] },
			"vaults",
			{ vaultIds: [SHORT_ID, FULL_ID] }
		)) as { vaults: Array<{ vaultObject: unknown }> };
		expect(selected.vaults[0]?.vaultObject).toEqual({ objectId: SHORT_ID });

		const single = (await expectPost(
			(client) => client.getVault({ vaultId: SHORT_ID }),
			{ vaults: [{ objectId: SHORT_ID }] },
			"vaults",
			{ vaultIds: [SHORT_ID] }
		)) as { vault: { vaultObject: { objectId: string } } };
		expect(single.vault.vaultObject.objectId).toBe(SHORT_ID);
	});

	it("serializes account position filters and bigint account IDs", async () => {
		const result = await expectPost(
			(client) =>
				client.getAccountObjects({
					accountIds: [ACCOUNT_ID],
					marketIds: [SHORT_ID],
				}),
			{ accounts: [{ accountId: ACCOUNT_ID_WIRE, positions: [] }] },
			"accounts/positions",
			{
				accountIds: [ACCOUNT_ID_WIRE],
				marketIds: [SHORT_ID],
			}
		);

		expect(result).toEqual({
			accounts: [{ accountId: ACCOUNT_ID, positions: [] }],
		});
	});

	it("pairs fetched accounts with their caps and supports the empty fast path", async () => {
		const cap = {
			objectId: SHORT_ID,
			walletAddress: FULL_ADDRESS,
			accountId: ACCOUNT_ID,
			accountObjectId: FULL_ID,
			collateralCoinType: COLLATERAL,
			collateral: 10,
			objectVersion: 1,
			objectDigest: "digest",
			isAgent: false,
			accountObjectInitialSharedVersion: 1,
			whitelistedAgentCapIds: [],
		};
		const result = (await expectPost(
			(client) => client.getAccounts({ accountCaps: [cap] }),
			{ accounts: [{ accountId: ACCOUNT_ID_WIRE, positions: [] }] },
			"accounts/positions",
			{ accountIds: [ACCOUNT_ID_WIRE], marketIds: undefined }
		)) as {
			accounts: Array<{
				account: Record<string, unknown>;
				accountCap: unknown;
			}>;
		};

		expect(result.accounts[0]?.account).toEqual({
			accountId: ACCOUNT_ID,
			positions: [],
		});
		expect(result.accounts[0]?.accountCap).toEqual(cap);

		const calls = installFetch({ error: "must not call" });
		await expect(
			clientForTest().getAccounts({ accountCaps: [] })
		).resolves.toEqual({
			accounts: [],
		});
		expect(calls).toHaveLength(0);
	});

	it("uses the account-position endpoint for the single-account convenience wrapper", async () => {
		const cap = { accountId: ACCOUNT_ID } as never;
		const result = (await expectPost(
			(client) => client.getAccount({ accountCap: cap }),
			{ accounts: [{ accountId: ACCOUNT_ID_WIRE, positions: [] }] },
			"accounts/positions",
			{ accountIds: [ACCOUNT_ID_WIRE], marketIds: undefined }
		)) as {
			account: { account: Record<string, unknown>; accountCap: unknown };
		};

		expect(result.account.account.accountId).toBe(ACCOUNT_ID);
		expect(result.account.accountCap).toEqual(cap);

		const calls = installFetch({ error: "must not call" });
		await expect(
			clientForTest().getAccountObjects({ accountIds: [] })
		).resolves.toEqual({ accounts: [] });
		expect(calls).toHaveLength(0);
	});

	it("routes ownership and admin-cap queries with optional fields", async () => {
		const owned = await expectPost(
			(client) => client.getOwnedAccountCaps({ walletAddress: FULL_ADDRESS }),
			{ accountCaps: [{ accountId: ACCOUNT_ID_WIRE }] },
			"accounts/owned",
			{ walletAddress: FULL_ADDRESS }
		);
		expect(owned).toEqual({ accountCaps: [{ accountId: ACCOUNT_ID }] });

		await expectPost(
			(client) =>
				client.getOwnedAccountCaps({
					walletAddress: FULL_ADDRESS,
					collateralCoinTypes: [COLLATERAL],
				}),
			{ accountCaps: [] },
			"accounts/owned",
			{ walletAddress: FULL_ADDRESS, collateralCoinTypes: [COLLATERAL] }
		);

		await expectPost(
			(client) => client.getOwnedVaultCaps({ walletAddress: FULL_ADDRESS }),
			{ ownedVaultCaps: [] },
			"vaults/owned-vault-caps",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) =>
				client.getOwnedVaultAssistantCaps({ walletAddress: FULL_ADDRESS }),
			{ ownedVaultAssistantCaps: [] },
			"vaults/owned-vault-assistant-caps",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) =>
				client.getOwnedVaultWithdrawRequests({ walletAddress: FULL_ADDRESS }),
			{ ownedWithdrawRequests: [] },
			"vaults/owned-withdraw-requests",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) => client.getOwnedVaultLpCoins({ walletAddress: FULL_ADDRESS }),
			{ ownedLpCoins: [] },
			"vaults/owned-lp-coins",
			{ walletAddress: FULL_ADDRESS }
		);
		await expectPost(
			(client) => client.getAdminAccountCaps({ accountIds: [ACCOUNT_ID] }),
			{ accountCaps: [] },
			"accounts",
			{ accountIds: [ACCOUNT_ID_WIRE] }
		);
	});

	it("routes historical market data and preserves pagination limits", async () => {
		await expectPost(
			(client) =>
				client.getMarketCandleHistory({
					marketId: SHORT_ID,
					fromTimestamp: 1_700_000_000_000,
					toTimestamp: 1_700_003_600_000,
					resolution: "1h",
				}),
			{ candles: [] },
			"market/candle-history",
			{
				marketId: SHORT_ID,
				fromTimestamp: 1_700_000_000_000,
				toTimestamp: 1_700_003_600_000,
				resolution: "1h",
			}
		);

		const funding = await expectPost(
			(client) =>
				client.getMarketFundingHistory({
					marketId: SHORT_ID,
					fromTimestamp: 1_700_000_000_000,
					toTimestamp: 1_700_003_600_000,
					limit: 2,
				}),
			{ history: [{ timestamp: 1_700_000_000_000 }] },
			"market/funding-history",
			{
				marketId: SHORT_ID,
				fromTimestamp: 1_700_000_000_000,
				toTimestamp: 1_700_003_600_000,
				limit: 2,
			}
		);
		expect(funding).toEqual({ history: [{ timestamp: 1_700_000_000_000 }] });

		await expectPost(
			(client) => client.getMarkets24hrStats({ marketIds: [SHORT_ID] }),
			{ marketsStats: [{ midPrice: null, markPrice: 101 }] },
			"markets/24hr-stats",
			{ marketIds: [SHORT_ID] }
		);
	});

	it("handles price and LP-price empty fast paths without transport calls", async () => {
		const calls = installFetch({ error: "must not call" });
		await expect(clientForTest().getPrices({ marketIds: [] })).resolves.toEqual(
			{
				marketsPrices: [],
			}
		);
		await expect(
			clientForTest().getLpCoinPrices({ vaultIds: [] })
		).resolves.toEqual({
			lpCoinPrices: [],
		});
		expect(calls).toHaveLength(0);
	});

	it("fetches market prices and LP coin prices with non-empty IDs", async () => {
		const prices = await expectPost(
			(client) => client.getPrices({ marketIds: [SHORT_ID] }),
			{
				marketsPrices: [
					{
						marketId: SHORT_ID,
						basePrice: 100,
						collateralPrice: 1,
						midPrice: null,
						markPrice: 101,
					},
				],
			},
			"markets/prices",
			{ marketIds: [SHORT_ID] }
		);
		expect(prices).toEqual({
			marketsPrices: [
				{
					marketId: SHORT_ID,
					basePrice: 100,
					collateralPrice: 1,
					midPrice: undefined,
					markPrice: 101,
				},
			],
		});

		await expectPost(
			(client) => client.getLpCoinPrices({ vaultIds: [SHORT_ID, FULL_ID] }),
			{ lpCoinPrices: [1.25, 0.99] },
			"vaults/lp-coin-prices",
			{ vaultIds: [SHORT_ID, FULL_ID] }
		);
	});

	it("serializes transaction wrapper bodies and reconstructs returned transaction kinds", async () => {
		const transfer = (await expectPost(
			(client) =>
				client.getTransferCapTx({
					recipientAddress: FULL_ADDRESS,
					capObjectId: SHORT_ID,
				}),
			{ txKind: "encoded-transfer" },
			"transactions/transfer-cap",
			{ recipientAddress: FULL_ADDRESS, capObjectId: SHORT_ID }
		)) as { tx: { mode: string; txKind: string } };
		expect(transfer.tx).toEqual({
			mode: "fromKind",
			txKind: "encoded-transfer",
		});

		const create = (await expectPost(
			(client) =>
				client.getCreateAccountTx({
					walletAddress: FULL_ADDRESS,
					collateralCoinType: COLLATERAL,
					deferShare: true,
				}),
			{
				txKind: "encoded-account",
				deferred: {
					accountArg: { kind: "Input", index: 0 },
					sharePolicyArg: { kind: "Input", index: 1 },
					adminCapArg: { kind: "Input", index: 2 },
					collateralCoinType: COLLATERAL,
				},
			},
			"transactions/create-account",
			{
				walletAddress: FULL_ADDRESS,
				collateralCoinType: COLLATERAL,
				deferShare: true,
			}
		)) as { tx: unknown; deferred: Record<string, unknown> };
		expect(create.tx).toEqual({ mode: "fromKind", txKind: "encoded-account" });
		expect(create.deferred.collateralCoinType).toBe(COLLATERAL);

		const grant = (await expectPost(
			(client) =>
				client.getGrantAgentWalletTx({
					recipientAddress: FULL_ADDRESS,
					accountId: ACCOUNT_ID,
				}),
			{ txKind: "encoded-grant" },
			"account/transactions/grant-agent-wallet",
			{ recipientAddress: FULL_ADDRESS, accountId: ACCOUNT_ID_WIRE }
		)) as { tx: unknown };
		expect(grant.tx).toEqual({ mode: "fromKind", txKind: "encoded-grant" });

		await expectPost(
			(client) =>
				client.getGrantVaultAgentWalletTx({
					vaultId: SHORT_ID,
					recipientAddress: FULL_ADDRESS,
					sponsor: { walletAddress: FULL_ADDRESS },
				}),
			{ txKind: "encoded-vault-grant" },
			"vault/transactions/owner/grant-agent-wallet",
			{
				vaultId: SHORT_ID,
				recipientAddress: FULL_ADDRESS,
				sponsor: { walletAddress: FULL_ADDRESS },
			}
		);

		await expectPost(
			(client) =>
				client.getRevokeVaultAgentWalletTx({
					vaultId: SHORT_ID,
					accountCapId: FULL_ID,
				}),
			{ txKind: "encoded-vault-revoke" },
			"vault/transactions/owner/revoke-agent-wallet",
			{ vaultId: SHORT_ID, accountCapId: FULL_ID }
		);

		await expectPost(
			(client) =>
				client.getShareAccountTx({
					accountArg: { kind: "Input", index: 0 } as never,
					sharePolicyArg: { kind: "Input", index: 1 } as never,
					adminCapArg: { kind: "Input", index: 2 } as never,
					collateralCoinType: COLLATERAL,
				}),
			{ txKind: "encoded-share" },
			"account/transactions/share",
			{
				accountArg: { kind: "Input", index: 0 } as never,
				sharePolicyArg: { kind: "Input", index: 1 } as never,
				adminCapArg: { kind: "Input", index: 2 } as never,
				collateralCoinType: COLLATERAL,
			}
		);
	});

	it("routes vault creation transaction variants and optional metadata", async () => {
		await expectPost(
			(client) =>
				client.getCreateVaultCapTx({
					walletAddress: FULL_ADDRESS,
					lpCoinMetadata: {
						name: "Aftermath Vault",
						symbol: "afV",
						description: "Test vault",
					},
					sponsor: { walletAddress: FULL_ADDRESS },
				}),
			{ txKind: "encoded-cap" },
			"vault/transactions/create-vault-cap",
			{
				walletAddress: FULL_ADDRESS,
				lpCoinMetadata: {
					name: "Aftermath Vault",
					symbol: "afV",
					description: "Test vault",
				},
				sponsor: { walletAddress: FULL_ADDRESS },
			}
		);

		await expectPost(
			(client) =>
				client.getCreateVaultTx({
					walletAddress: FULL_ADDRESS,
					metadata: { name: "Vault", description: "A test vault" },
					coinMetadataId: SHORT_ID,
					treasuryCapId: FULL_ID,
					collateralCoinType: COLLATERAL,
					lockPeriodMs: 86_400_000n,
					performanceFeePercentage: 0.2,
					forceWithdrawDelayMs: 3_600_000n,
					initialDepositAmount: 12345678901234567890n,
					isSponsoredTx: true,
				}),
			{ txKind: "encoded-vault" },
			"vault/transactions/create-vault",
			{
				walletAddress: FULL_ADDRESS,
				metadata: { name: "Vault", description: "A test vault" },
				coinMetadataId: SHORT_ID,
				treasuryCapId: FULL_ID,
				collateralCoinType: COLLATERAL,
				lockPeriodMs: "86400000n",
				performanceFeePercentage: 0.2,
				forceWithdrawDelayMs: "3600000n",
				initialDepositAmount: "12345678901234567890n",
				isSponsoredTx: true,
			}
		);
	});

	it("routes rebate calculations, CSV reports, and builder-code inspections", async () => {
		const calculationVariables = {
			qScoreCoefficient: 1,
			uptimeCoefficient: 0.5,
			mmVolumeCoefficient: 1,
			takerVolumeCoefficient: 1,
			takerOiCoefficient: 0.25,
		};
		const rewards = await expectPost(
			(client) =>
				client.getCurrentRebateRewards({
					accountIds: [ACCOUNT_ID],
					totalMakerRewards: 100,
					totalTakerRewards: 50,
					calculationVariables,
				}),
			{
				totalQScoreFinal: 3,
				totalEstimatedGasCost: 0.01,
				rewards: [{ accountId: ACCOUNT_ID_WIRE, maker: {}, taker: {} }],
			},
			"rebates/rewards",
			{
				accountIds: [ACCOUNT_ID_WIRE],
				totalMakerRewards: 100,
				totalTakerRewards: 50,
				calculationVariables,
			}
		);
		expect(
			(rewards as { rewards: Array<{ accountId: bigint }> }).rewards[0]
				?.accountId
		).toBe(ACCOUNT_ID);

		await expectPost(
			(client) =>
				client.getCsvRebates({
					totalMakerRewards: 100,
					totalTakerRewards: 50,
					calculationVariables,
					aggregated: true,
				}),
			{ csv: "account,rewards\n" },
			"rebates/create-csv-rebates",
			{
				totalMakerRewards: 100,
				totalTakerRewards: 50,
				calculationVariables,
				aggregated: true,
			}
		);
		await expectPost(
			(client) =>
				client.getReferralCsvRebates({
					epochStartTimestampMs: 1_700_000_000_000,
					epochEndTimestampMs: 1_700_086_400_000,
				}),
			{ csv: "referrer,commission\n" },
			"rebates/create-referral-csv-rebates",
			{
				epochStartTimestampMs: 1_700_000_000_000,
				epochEndTimestampMs: 1_700_086_400_000,
			}
		);

		await expectPost(
			(client) =>
				client.getBuilderCodeIntegratorConfig({
					accountId: ACCOUNT_ID,
					integratorId: 7,
				}),
			{ maxIntegratorFee: null, exists: false },
			"builder-codes/integrator-config",
			{ accountId: ACCOUNT_ID_WIRE, integratorId: 7 }
		);
		await expectPost(
			(client) => client.getBuilderCodeIntegratorVaults({ integratorId: 7 }),
			{ integratorVaults: [] },
			"builder-codes/integrator-vaults",
			{ integratorId: 7 }
		);
	});

	it("derives txKind from the optional shared AftermathApi transaction helper", async () => {
		const tx = { marker: "existing transaction" };
		const fetchBase64TxKindFromTx = (input: { tx: unknown }) => {
			expect(input.tx).toBe(tx);
			return "existing-kind";
		};
		const api = {
			Transactions: () => ({ fetchBase64TxKindFromTx }),
		};
		const calls = installFetch({ txKind: "encoded" });
		const result = await new PerpetualsClient(
			{ baseUrl: API_BASE_URL },
			api as never
		).getCreateAccountTx({
			walletAddress: FULL_ADDRESS,
			collateralCoinType: COLLATERAL,
			tx: tx as never,
		});

		expect(requestBody(calls[0] as FetchCall)).toEqual({
			walletAddress: FULL_ADDRESS,
			collateralCoinType: COLLATERAL,
			txKind: "existing-kind",
		});
		expect(result.tx).toEqual({ mode: "fromKind", txKind: "encoded" });
	});
});

function clientForTest(): Perpetuals {
	return new PerpetualsClient({ baseUrl: API_BASE_URL });
}

describe("Perpetuals transport and malformed-response behavior", () => {
	it("classifies non-2xx responses and preserves retry metadata", async () => {
		installFetch("service unavailable", 429, { "Retry-After": "3" });
		const error = await clientForTest()
			.getPrices({ marketIds: [SHORT_ID] })
			.catch((value: unknown) => value);

		expect(isAftermathTransportError(error)).toBe(true);
		expect(error).toBeInstanceOf(AftermathTransportError);
		expect(error).toMatchObject({
			kind: "http",
			status: 429,
			retryAfterMs: 3000,
		});
		expect((error as Error).message).toContain("service unavailable");
	});

	it("classifies network failures at the public wrapper boundary", async () => {
		installFetchHandler(() => Promise.reject(new Error("offline")));
		const error = await clientForTest()
			.getVaultsConfig()
			.catch((value: unknown) => value);

		expect(error).toMatchObject({ kind: "network", message: "offline" });
		expect(error).toBeInstanceOf(AftermathTransportError);
	});

	it("classifies caller-triggered aborts", async () => {
		const controller = new AbortController();
		installFetchHandler((_input, init) => {
			controller.abort("caller cancelled");
			return Promise.reject(
				Object.assign(new Error("request aborted"), {
					name: "AbortError",
					signal: init?.signal,
				})
			);
		});
		const error = await clientForTest()
			.getVaultsConfig(controller.signal)
			.catch((value: unknown) => value);

		expect(error).toMatchObject({
			kind: "abort",
			abortSource: "caller",
		});
	});

	it("classifies invalid JSON before a response reaches the wrapper", async () => {
		installFetch("{not-json");
		const error = await clientForTest()
			.getMarkets24hrStats({ marketIds: [SHORT_ID] })
			.catch((value: unknown) => value);

		expect(error).toMatchObject({ kind: "decode" });
		expect(error).toBeInstanceOf(AftermathTransportError);
	});

	it("surfaces missing required response collections as malformed data", async () => {
		installFetch({});
		await expect(
			clientForTest().getAllMarkets({ collateralCoinType: COLLATERAL })
		).rejects.toThrow(MALFORMED_COLLECTION_REGEX);
	});
});
