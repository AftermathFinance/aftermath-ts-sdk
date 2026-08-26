import { jest as jestApi } from "@jest/globals";
import type { BcsType } from "@mysten/sui/bcs";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SuiEvent, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi as AftermathApiType } from "../src/general/providers/aftermathApi";
import type { Event } from "../src/general/types";
import type { ConfigAddresses } from "../src/general/types/configTypes";
import type { SuiObjectView } from "../src/general/utils/grpcCasting";

// The shared tsconfig typechecks tests with the global Jest declarations,
// while ESM execution supplies the explicit Jest object. Keep mock fixtures
// deliberately structural and let the public SDK calls provide the useful
// type checks.
const jest = jestApi as unknown as {
	fn: (...args: any[]) => any;
	spyOn: typeof jestApi.spyOn;
	restoreAllMocks: typeof jestApi.restoreAllMocks;
};

// Helpers and the API-helper classes have a legacy ESM cycle through their
// static convenience references. Loading the leaf module first keeps this
// test's module graph deterministic without changing production code.
await import("../src/general/utils/helpers");
const { Transaction: TransactionClass } = await import(
	"@mysten/sui/transactions"
);
const { Aftermath } = await import("../src/general/providers/aftermath");
const { AftermathApi } = await import("../src/general/providers/aftermathApi");
const { DynamicFieldsApiHelpers } = await import(
	"../src/general/apiHelpers/dynamicFieldsApiHelpers"
);
const { EventsApiHelpers } = await import(
	"../src/general/apiHelpers/eventsApiHelpers"
);
const { InspectionsApiHelpers } = await import(
	"../src/general/apiHelpers/inspectionsApiHelpers"
);
const { ObjectsApiHelpers } = await import(
	"../src/general/apiHelpers/objectsApiHelpers"
);
const { TransactionsApiHelpers } = await import(
	"../src/general/apiHelpers/transactionsApiHelpers"
);
const { DynamicGas } = await import("../src/general/dynamicGas/dynamicGas");
const { default: PriceFeeds } = await import(
	"../src/general/priceFeeds/priceFeeds"
);
const { default: PriceFeedsApi } = await import(
	"../src/general/priceFeeds/priceFeedsApi"
);
const { NftsApi } = await import("../src/general/nfts/nftsApi");
const { NftsApiCasting } = await import("../src/general/nfts/nftsApiCasting");
const { Prices } = await import("../src/general/prices/prices");
const { Wallet } = await import("../src/general/wallet/wallet");
const { WalletApi } = await import("../src/general/wallet/walletApi");

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

type FetchHandler = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const originalFetch = globalThis.fetch;

const OWNER =
	"0x00000000000000000000000000000000000000000000000000000000000000aa";
const PACKAGE_NFT =
	"0x1111111111111111111111111111111111111111111111111111111111111111";
const OBJECT_1 =
	"0x0000000000000000000000000000000000000000000000000000000000000001";
const OBJECT_2 =
	"0x0000000000000000000000000000000000000000000000000000000000000002";
const OBJECT_3 =
	"0x0000000000000000000000000000000000000000000000000000000000000003";
const KIOSK_TYPE =
	"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk";
const KIOSK_CAP_TYPE =
	"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap";

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetch(
	body: unknown,
	status = 200,
	headers?: HeadersInit
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		const responseBody = typeof body === "string" ? body : JSON.stringify(body);
		return Promise.resolve(new Response(responseBody, { status, headers }));
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

function requestBody(calls: FetchCall[]): Record<string, unknown> {
	const body = calls[0]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(body) as Record<string, unknown>;
}

function makeApi(
	client: Record<string, unknown>,
	addresses: ConfigAddresses = {},
	jsonRpcClient?: Record<string, unknown>
): AftermathApiType {
	return new AftermathApi(
		client as unknown as SuiGrpcClient,
		addresses,
		jsonRpcClient as unknown as SuiJsonRpcClient
	);
}

function makeObjectView(
	overrides: Record<string, unknown> = {}
): SuiObjectView {
	return {
		objectId: OBJECT_1,
		version: "7",
		digest: "digest-1",
		type: `${PACKAGE_NFT}::collectible::Collectible`,
		owner: { AddressOwner: OWNER },
		json: {},
		display: { output: {}, errors: null },
		...overrides,
	} as unknown as SuiObjectView;
}

function dynamicFieldEntry(
	fieldId: string,
	valueType: string,
	byte: number,
	kind: "DynamicField" | "DynamicObject" = "DynamicField"
) {
	return {
		$kind: kind,
		fieldId,
		valueType,
		name: {
			type: "0x1::string::String",
			bcs: new Uint8Array([byte]),
		},
	};
}

function event(type: string, timestamp: number | undefined, id: string): Event {
	return { type, timestamp, txnDigest: id };
}

describe("Caller-backed general services", () => {
	it("Prices posts coin requests, casts bigint response values, and preserves auth", async () => {
		const calls = installFetch({
			"0x2::sui::SUI": {
				price: 1.23,
				priceChange24HoursPercentage: -2.5,
			},
		});
		const prices = new Prices({
			baseUrl: "https://sdk.test/",
			accessToken: "price-token",
		});

		await expect(
			prices.getCoinsToPriceInfo({ coins: ["0x2::sui::SUI"] })
		).resolves.toEqual({
			"0x2::sui::SUI": {
				price: 1.23,
				priceChange24HoursPercentage: -2.5,
			},
		});

		expect(calls[0]?.input).toBe("https://sdk.test/api/price-info");
		expect(requestBody(calls)).toEqual({ coins: ["0x2::sui::SUI"] });
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.init?.headers).toEqual({
			"Content-Type": "application/json",
			Authorization: "Bearer price-token",
		});
	});

	it("Prices expose single and projected price methods over the same response contract", async () => {
		const response = {
			"0x2::sui::SUI": {
				price: 2.75,
				priceChange24HoursPercentage: 4,
			},
			"0xabc::coin::COIN": {
				price: 0.125,
				priceChange24HoursPercentage: 0,
			},
		};
		const prices = new Prices({ baseUrl: "https://sdk.test" });

		installFetch(response);
		await expect(
			prices.getCoinPriceInfo({ coin: "0x2::sui::SUI" })
		).resolves.toEqual(response["0x2::sui::SUI"]);

		installFetch(response);
		await expect(prices.getCoinPrice({ coin: "0x2::sui::SUI" })).resolves.toBe(
			2.75
		);

		installFetch(response);
		await expect(
			prices.getCoinsToPrice({
				coins: ["0x2::sui::SUI", "0xabc::coin::COIN"],
			})
		).resolves.toEqual({
			"0x2::sui::SUI": 2.75,
			"0xabc::coin::COIN": 0.125,
		});
	});

	it("Wallet sends the wallet address on balance and history requests and preserves bigint precision", async () => {
		const wallet = new Wallet("0xwallet", { baseUrl: "https://sdk.test" });

		const balancesCalls = installFetch(["1000000000000000001n", "2n"]);
		await expect(
			wallet.getBalances({
				coins: ["0x2::sui::SUI", "0xabc::coin::COIN"],
			})
		).resolves.toEqual([1000000000000000001n, 2n]);
		expect(balancesCalls[0]?.input).toBe(
			"https://sdk.test/api/wallet/coin-balances"
		);
		expect(requestBody(balancesCalls)).toEqual({
			coins: ["0x2::sui::SUI", "0xabc::coin::COIN"],
			walletAddress: "0xwallet",
		});

		const allBalancesCalls = installFetch({
			"0x2::sui::SUI": "9007199254740993123n",
		});
		await expect(wallet.getAllBalances()).resolves.toEqual({
			"0x2::sui::SUI": 9007199254740993123n,
		});
		expect(allBalancesCalls[0]?.input).toBe(
			"https://sdk.test/api/wallet/all-coin-balances"
		);
		expect(requestBody(allBalancesCalls)).toEqual({
			walletAddress: "0xwallet",
		});

		const history = {
			transactions: [{ digest: "tx-1", balanceChanges: [] }],
			nextCursor: "tx-cursor-2",
		};
		const historyCalls = installFetch(history);
		await expect(
			wallet.getPastTransactions({ cursor: "tx-cursor-1", limit: 17 })
		).resolves.toEqual(history);
		expect(historyCalls[0]?.input).toBe(
			"https://sdk.test/api/wallet/past-transactions"
		);
		expect(requestBody(historyCalls)).toEqual({
			cursor: "tx-cursor-1",
			limit: 17,
			walletAddress: "0xwallet",
		});
	});

	it("Wallet single-balance lookup returns the first requested balance", async () => {
		const calls = installFetch(["42n"]);
		const wallet = new Wallet("0xwallet", { baseUrl: "https://sdk.test" });

		await expect(wallet.getBalance({ coin: "0x2::sui::SUI" })).resolves.toBe(
			42n
		);
		expect(requestBody(calls)).toEqual({
			coins: ["0x2::sui::SUI"],
			walletAddress: "0xwallet",
		});
	});

	it("DynamicGas posts the serialized transaction and coin preference to its service prefix", async () => {
		const calls = installFetch({
			txBytes: "updated-tx",
			sponsoredSignature: "sig",
		});
		const tx = {
			serialize: jest.fn(() => "serialized-tx"),
		} as unknown as Transaction;
		const dynamicGas = new DynamicGas({ baseUrl: "https://sdk.test" });

		await expect(
			dynamicGas.getUseDynamicGasForTx({
				tx,
				walletAddress: "0xwallet",
				gasCoinType: "0x2::sui::SUI",
			})
		).resolves.toEqual({ txBytes: "updated-tx", sponsoredSignature: "sig" });

		expect(tx.serialize).toHaveBeenCalledTimes(1);
		expect(calls[0]?.input).toBe("https://sdk.test/api/dynamic-gas");
		expect(requestBody(calls)).toEqual({
			serializedTx: "serialized-tx",
			walletAddress: "0xwallet",
			gasCoinType: "0x2::sui::SUI",
		});
	});

	it("service calls fail clearly when no API base URL is configured", async () => {
		await expect(
			new Prices().getCoinsToPriceInfo({ coins: ["0x2::sui::SUI"] })
		).rejects.toThrow("no apiBaseUrl: unable to fetch data");
	});

	it("the inactive price-feed modules remain explicit empty exports", () => {
		expect(PriceFeeds).toEqual({});
		expect(PriceFeedsApi).toEqual({});
	});
});

describe("DynamicFieldsApiHelpers", () => {
	it("lists, casts, filters, and forwards cursor/limit values through the gRPC client", async () => {
		const listDynamicFields = jest.fn().mockResolvedValue({
			dynamicFields: [
				dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 1),
				dynamicFieldEntry(OBJECT_2, "0x2::field::Other", 2, "DynamicObject"),
			],
			cursor: OBJECT_3,
		});
		const api = makeApi({ listDynamicFields });
		const helper = new DynamicFieldsApiHelpers(api);

		await expect(
			helper.fetchDynamicFieldsOfTypeWithCursor({
				parentObjectId: OBJECT_3,
				cursor: OBJECT_1,
				limit: 2,
				dynamicFieldType: "0x2::field::Wanted",
			})
		).resolves.toEqual({
			dynamicFields: [
				{
					name: {
						type: "0x1::string::String",
						value: "AQ==",
					},
					bcsEncoding: "base64",
					bcsName: "AQ==",
					type: "DynamicField",
					objectType: "0x2::field::Wanted",
					objectId: OBJECT_1,
				},
			],
			nextCursor: OBJECT_3,
		});
		expect(listDynamicFields).toHaveBeenCalledWith({
			parentId: OBJECT_3,
			cursor: OBJECT_1,
			limit: 2,
		});

		await helper.fetchDynamicFieldsOfTypeWithCursor({
			parentObjectId: OBJECT_3,
			dynamicFieldType: (type) => type.endsWith("Other"),
		});
		expect(listDynamicFields).toHaveBeenLastCalledWith({
			parentId: OBJECT_3,
			cursor: undefined,
			limit: 256,
		});
	});

	it("casts one page of dynamic fields to objects and preserves the next cursor", async () => {
		const listDynamicFields = jest.fn().mockResolvedValue({
			dynamicFields: [dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 9)],
			cursor: OBJECT_2,
		});
		const objectsFromObjectIds = jest
			.fn()
			.mockResolvedValue([{ id: OBJECT_1 }]);
		const helper = new DynamicFieldsApiHelpers(makeApi({ listDynamicFields }));

		await expect(
			helper.fetchCastDynamicFieldsOfTypeWithCursor({
				parentObjectId: OBJECT_3,
				objectsFromObjectIds,
			})
		).resolves.toEqual({
			dynamicFieldObjects: [{ id: OBJECT_1 }],
			nextCursor: OBJECT_2,
		});
		expect(objectsFromObjectIds).toHaveBeenCalledWith([OBJECT_1]);
	});

	it("fetches every dynamic-field page with the configured step size", async () => {
		const listDynamicFields = jest
			.fn()
			.mockResolvedValueOnce({
				dynamicFields: [dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 1)],
				cursor: OBJECT_2,
			})
			.mockResolvedValueOnce({
				dynamicFields: [dynamicFieldEntry(OBJECT_2, "0x2::field::Wanted", 2)],
				cursor: null,
			});
		const helper = new DynamicFieldsApiHelpers(makeApi({ listDynamicFields }));

		await expect(
			helper.fetchAllDynamicFieldsOfType({
				parentObjectId: OBJECT_3,
				limitStepSize: 1,
			})
		).resolves.toHaveLength(2);
		expect(listDynamicFields).toHaveBeenNthCalledWith(1, {
			parentId: OBJECT_3,
			cursor: undefined,
			limit: 1,
		});
		expect(listDynamicFields).toHaveBeenNthCalledWith(2, {
			parentId: OBJECT_3,
			cursor: OBJECT_2,
			limit: 1,
		});
	});

	it("casts all dynamic-field pages in one object-id batch", async () => {
		const listDynamicFields = jest.fn().mockResolvedValue({
			dynamicFields: [
				dynamicFieldEntry(OBJECT_1, "0x2::field::Wanted", 1),
				dynamicFieldEntry(OBJECT_2, "0x2::field::Wanted", 2),
			],
			cursor: null,
		});
		const objectsFromObjectIds = jest
			.fn()
			.mockResolvedValue([{ id: OBJECT_1 }, { id: OBJECT_2 }]);
		const helper = new DynamicFieldsApiHelpers(makeApi({ listDynamicFields }));

		await expect(
			helper.fetchCastAllDynamicFieldsOfType({
				parentObjectId: OBJECT_3,
				objectsFromObjectIds,
				limitStepSize: 32,
			})
		).resolves.toEqual([{ id: OBJECT_1 }, { id: OBJECT_2 }]);
		expect(objectsFromObjectIds).toHaveBeenCalledWith([OBJECT_1, OBJECT_2]);
	});

	it("fetchDynamicFieldsUntil stops after completion and forwards the returned cursor", async () => {
		const fetchFunc: (inputs: { cursor?: string; limit?: number }) => Promise<{
			dynamicFieldObjects: Array<{ id: string }>;
			nextCursor: string | null;
		}> = jest
			.fn()
			.mockResolvedValueOnce({
				dynamicFieldObjects: [{ id: OBJECT_1 }, { id: OBJECT_2 }],
				nextCursor: OBJECT_3,
			})
			.mockResolvedValueOnce({
				dynamicFieldObjects: [{ id: "complete" }],
				nextCursor: null,
			});
		const helper = new DynamicFieldsApiHelpers(makeApi({}));

		await expect(
			helper.fetchDynamicFieldsUntil({
				fetchFunc,
				limitStepSize: 4,
				isComplete: (objects) =>
					objects.some((object) => object.id === "complete"),
			})
		).resolves.toEqual({
			dynamicFieldObjects: [
				{ id: OBJECT_1 },
				{ id: OBJECT_2 },
				{ id: "complete" },
			],
			nextCursor: null,
		});
		expect(fetchFunc).toHaveBeenNthCalledWith(1, {
			cursor: undefined,
			limit: 4,
		});
		expect(fetchFunc).toHaveBeenNthCalledWith(2, {
			cursor: OBJECT_3,
			limit: 4,
		});
	});

	it("returns immediately when the accumulated dynamic-field objects satisfy the predicate", async () => {
		const fetchFunc = jest.fn().mockResolvedValue({
			dynamicFieldObjects: [{ id: "complete-on-first-page" }],
			nextCursor: OBJECT_1,
		});

		await expect(
			new DynamicFieldsApiHelpers(makeApi({})).fetchDynamicFieldsUntil({
				fetchFunc,
				isComplete: () => true,
			})
		).resolves.toEqual({
			dynamicFieldObjects: [{ id: "complete-on-first-page" }],
			nextCursor: OBJECT_1,
		});
		expect(fetchFunc).toHaveBeenCalledTimes(1);
	});

	it("fetchDynamicFieldObject requests the gRPC object view needed by casters", async () => {
		const object = makeObjectView();
		const getDynamicObjectField = jest.fn().mockResolvedValue({ object });
		const api = makeApi({ core: { getDynamicObjectField } });

		await expect(
			new DynamicFieldsApiHelpers(api).fetchDynamicFieldObject({
				parentId: OBJECT_3,
				name: { type: "0x1::string::String", bcs: new Uint8Array([1, 2]) },
			})
		).resolves.toBe(object);
		expect(getDynamicObjectField).toHaveBeenCalledWith({
			parentId: OBJECT_3,
			name: { type: "0x1::string::String", bcs: new Uint8Array([1, 2]) },
			include: { json: true, display: true },
		});
	});
});

describe("EventsApiHelpers", () => {
	it("queries JSON-RPC events with a stringified event sequence and casts the page", async () => {
		const queryEvents = jest.fn().mockResolvedValue({
			data: [{ type: "raw-event", value: 7 }],
			nextCursor: undefined,
		});
		const api = makeApi({}, {}, { queryEvents });
		const query = { MoveEventType: "0x2::module::Event" } as never;
		const cursor = { txDigest: "digest-1", eventSeq: "7" } as never;

		await expect(
			new EventsApiHelpers(api).fetchCastEventsWithCursor({
				query,
				cursor,
				limit: 5,
				eventFromEventOnChain: (raw: { type: string; value: number }) => ({
					type: raw.type,
					value: raw.value + 1,
				}),
			})
		).resolves.toEqual({
			events: [{ type: "raw-event", value: 8 }],
			nextCursor: null,
		});
		expect(queryEvents).toHaveBeenCalledWith({
			query,
			cursor: { txDigest: "digest-1", eventSeq: "7" },
			limit: 5,
		});
	});

	it("requires the optional JSON-RPC client for the legacy event query seam", async () => {
		const helper = new EventsApiHelpers(makeApi({}));

		await expect(
			helper.fetchCastEventsWithCursor({
				query: { All: true } as never,
				eventFromEventOnChain: (value: unknown) => value,
			})
		).rejects.toThrow(
			"Events().fetchCastEventsWithCursor requires a `SuiJsonRpcClient`"
		);
	});

	it("fetches events within a time window and stops at the first stale event", async () => {
		jest.spyOn(Date, "now").mockReturnValue(1_000_000);
		const fetchEventsFunc = jest.fn().mockResolvedValue({
			events: [
				event("fresh", 999_500, "tx-fresh"),
				event("stale", 998_000, "tx-stale"),
			],
			nextCursor: { txDigest: "next", eventSeq: "2" },
		});

		await expect(
			new EventsApiHelpers(makeApi({})).fetchEventsWithinTime({
				fetchEventsFunc,
				timeMs: 1000,
				limitStepSize: 9,
			})
		).resolves.toEqual([event("fresh", 999_500, "tx-fresh")]);
		expect(fetchEventsFunc).toHaveBeenCalledWith({
			cursor: undefined,
			limit: 9,
		});
	});

	it("fetches all event pages until an empty page or null cursor", async () => {
		const fetchEventsFunc = jest
			.fn()
			.mockResolvedValueOnce({
				events: [event("first", undefined, "tx-1")],
				nextCursor: { txDigest: "next", eventSeq: "1" },
			})
			.mockResolvedValueOnce({
				events: [event("second", undefined, "tx-2")],
				nextCursor: null,
			});

		await expect(
			new EventsApiHelpers(makeApi({})).fetchAllEvents({
				fetchEventsFunc,
				limitStepSize: 3,
			})
		).resolves.toEqual([
			event("first", undefined, "tx-1"),
			event("second", undefined, "tx-2"),
		]);
		expect(fetchEventsFunc).toHaveBeenNthCalledWith(1, {
			cursor: undefined,
			limit: 3,
		});
		expect(fetchEventsFunc).toHaveBeenNthCalledWith(2, {
			cursor: { txDigest: "next", eventSeq: "1" },
			limit: 3,
		});
	});

	it("supports event type matching, exact matching, callback resolution, and transaction search", () => {
		const matching = {
			type: "0xpackage::module::WrappedEvent<0xpackage::module::Event>",
			parsedJson: { amount: "9" },
		} as unknown as SuiEvent;
		const other = {
			type: "0xpackage::module::Other",
			parsedJson: {},
		} as unknown as SuiEvent;
		const cast = (raw: SuiEvent) => ({
			type: raw.type,
			parsed: raw.parsedJson,
		});

		expect(
			EventsApiHelpers.suiEventOfTypeOrUndefined(
				matching,
				"0xpackage::module::Event"
			)
		).toBe(matching);
		expect(
			EventsApiHelpers.suiEventOfTypeOrUndefined(
				other,
				() => "0xpackage::module::Event"
			)
		).toBeUndefined();
		expect(
			EventsApiHelpers.castEventOfTypeOrUndefined(
				matching,
				"0xpackage::module::Event",
				cast,
				true
			)
		).toBeUndefined();
		expect(
			EventsApiHelpers.castEventOfTypeOrUndefined(
				matching,
				() => "0xpackage::module::WrappedEvent<0xpackage::module::Event>",
				cast,
				true
			)
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventsOrUndefined({
				events: [other, matching, matching],
				eventType: "0xpackage::module::Event",
				castFunction: cast,
			})
		).toHaveLength(2);
		expect(
			EventsApiHelpers.findCastEventOrUndefined({
				events: [other, matching],
				eventType: "0xpackage::module::Event",
				castFunction: cast,
			})
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventInTransactionOrUndefined(
				{ events: [other, matching] } as never,
				"0xpackage::module::Event",
				cast
			)
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventInTransactionsOrUndefined(
				[{ events: [other] }, { events: [matching] }] as never,
				"0xpackage::module::Event",
				cast
			)
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventInTransactionsOrUndefined(
				[{ events: [other] }] as never,
				"0xpackage::module::Event",
				cast
			)
		).toBeUndefined();
		expect(
			EventsApiHelpers.createEventType(
				"0xpackage",
				"module",
				"Event",
				"Wrapper"
			)
		).toBe("Wrapper<0xpackage::module::Event>");
		expect(
			EventsApiHelpers.createEventType("0xpackage", "module", "Event")
		).toBe("0xpackage::module::Event");
	});

	it("reports the deprecated event subscription as an explicit unsupported operation", async () => {
		await expect(
			new EventsApiHelpers(makeApi({})).fetchSubscribeToUserEvents({
				address: OWNER,
				onEvent: jest.fn(),
			})
		).rejects.toThrow("fetchSubscribeToUserEvents is not implemented");
	});

	it("caps time-window pagination at its deterministic loop limit", async () => {
		const fetchEventsFunc = jest.fn().mockResolvedValue({
			events: [event("fresh", undefined, "tx-fresh")],
			nextCursor: { txDigest: "next", eventSeq: "1" },
		});

		await expect(
			new EventsApiHelpers(makeApi({})).fetchEventsWithinTime({
				fetchEventsFunc,
				timeMs: 1000,
			})
		).resolves.toHaveLength(20);
		expect(fetchEventsFunc).toHaveBeenCalledTimes(20);
	});
});

describe("InspectionsApiHelpers", () => {
	function successfulSimulation() {
		return {
			$kind: "Transaction",
			Transaction: {
				effects: { gasUsed: { computationCost: "7", storageCost: "3" } },
				events: [{ event: "event-1" }],
				status: { success: true },
			},
			commandResults: [
				{ returnValues: [{ bcs: new Uint8Array([1, 2]) }] },
				{
					returnValues: [
						{ bcs: new Uint8Array([3]) },
						{ bcs: new Uint8Array([]) },
					],
				},
			],
		};
	}

	it("simulates a cloned transaction with the default inspect signer and returns every command's BCS bytes", async () => {
		const simulateTransaction = jest
			.fn()
			.mockResolvedValue(successfulSimulation());
		const tx = new TransactionClass();
		const api = makeApi({ simulateTransaction });

		await expect(
			new InspectionsApiHelpers(api).fetchAllBytesFromTx({ tx })
		).resolves.toEqual({
			events: [{ event: "event-1" }],
			effects: { gasUsed: { computationCost: "7", storageCost: "3" } },
			allBytes: [[[1, 2]], [[3], []]],
		});
		expect(simulateTransaction).toHaveBeenCalledWith({
			transaction: expect.any(TransactionClass),
			include: { effects: true, events: true, commandResults: true },
			checksEnabled: false,
		});
		expect(
			simulateTransaction.mock.calls[0]?.[0].transaction.getData().sender
		).toBe(InspectionsApiHelpers.constants.devInspectSigner);
		expect(tx.getData().sender).toBeNull();
	});

	it("uses an explicit sender and exposes first/last command output wrappers", async () => {
		const simulateTransaction = jest
			.fn()
			.mockResolvedValue(successfulSimulation());
		const helper = new InspectionsApiHelpers(makeApi({ simulateTransaction }));
		const tx = new TransactionClass();

		await expect(
			helper.fetchFirstBytesFromTxOutput({ tx, sender: OWNER })
		).resolves.toEqual([3]);
		await expect(
			helper.fetchAllBytesFromTxOutput({ tx, sender: OWNER })
		).resolves.toEqual([[3], []]);
		expect(
			simulateTransaction.mock.calls[0]?.[0].transaction.getData().sender
		).toBe(OWNER);
	});

	it("surfaces failed simulation status and missing command results", async () => {
		const failed = {
			$kind: "FailedTransaction",
			FailedTransaction: {
				effects: { gasUsed: { computationCost: "1", storageCost: "0" } },
				events: [],
				status: { success: false, error: { message: "Move abort" } },
			},
			commandResults: [],
		};
		const failedHelper = new InspectionsApiHelpers(
			makeApi({ simulateTransaction: jest.fn().mockResolvedValue(failed) })
		);
		await expect(
			failedHelper.fetchAllBytesFromTx({ tx: new TransactionClass() })
		).rejects.toThrow("Move abort");

		const noResults = {
			$kind: "Transaction",
			Transaction: { effects: {}, events: [], status: { success: true } },
		};
		const noResultsHelper = new InspectionsApiHelpers(
			makeApi({ simulateTransaction: jest.fn().mockResolvedValue(noResults) })
		);
		await expect(
			noResultsHelper.fetchAllBytesFromTx({ tx: new TransactionClass() })
		).rejects.toThrow("dev inspect move call returned no results");
	});
});

describe("ObjectsApiHelpers", () => {
	it("distinguishes existing and missing objects at the gRPC boundary", async () => {
		const getObject = jest
			.fn()
			.mockResolvedValueOnce({ object: makeObjectView() })
			.mockRejectedValueOnce(new Error("object not found"));
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(helper.fetchDoesObjectExist(OBJECT_1)).resolves.toBe(true);
		await expect(helper.fetchDoesObjectExist(OBJECT_2)).resolves.toBe(false);
		expect(getObject).toHaveBeenNthCalledWith(1, { objectId: OBJECT_1 });
		expect(getObject).toHaveBeenNthCalledWith(2, { objectId: OBJECT_2 });
	});

	it("checks both address-owner forms and returns false for absent or different owners", async () => {
		const getObject = jest
			.fn()
			.mockResolvedValueOnce({
				object: makeObjectView({ owner: { AddressOwner: OWNER } }),
			})
			.mockResolvedValueOnce({
				object: makeObjectView({ owner: { ObjectOwner: OWNER } }),
			})
			.mockResolvedValueOnce({
				object: makeObjectView({ owner: { AddressOwner: "0xother" } }),
			})
			.mockResolvedValueOnce({ object: makeObjectView({ owner: undefined }) });
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_1,
				walletAddress: OWNER,
			})
		).resolves.toBe(true);
		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_2,
				walletAddress: OWNER,
			})
		).resolves.toBe(true);
		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_3,
				walletAddress: OWNER,
			})
		).resolves.toBe(false);
		await expect(
			helper.fetchIsObjectOwnedByAddress({
				objectId: OBJECT_3,
				walletAddress: OWNER,
			})
		).resolves.toBe(false);
	});

	it("pages owned objects, pins the caster include flags, and forwards type filters", async () => {
		const listOwnedObjects = jest
			.fn()
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_1 })],
				cursor: "owned-cursor-1",
				hasNextPage: true,
			})
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_2 })],
				cursor: null,
				hasNextPage: false,
			});
		const helper = new ObjectsApiHelpers(makeApi({ listOwnedObjects }));

		await expect(
			helper.fetchObjectsOfTypeOwnedByAddress({
				walletAddress: OWNER,
				objectType: KIOSK_CAP_TYPE,
				withDisplay: true,
			})
		).resolves.toEqual([
			makeObjectView({ objectId: OBJECT_1 }),
			makeObjectView({ objectId: OBJECT_2 }),
		]);
		expect(listOwnedObjects).toHaveBeenNthCalledWith(1, {
			owner: OWNER,
			type: KIOSK_CAP_TYPE,
			include: { json: true, display: true },
			limit: 50,
			cursor: undefined,
		});
		expect(listOwnedObjects).toHaveBeenNthCalledWith(2, {
			owner: OWNER,
			type: KIOSK_CAP_TYPE,
			include: { json: true, display: true },
			limit: 50,
			cursor: "owned-cursor-1",
		});
	});

	it("stops owned-object pagination when a page is empty even if the server advertises another page", async () => {
		const listOwnedObjects = jest.fn().mockResolvedValue({
			objects: [],
			cursor: "ignored",
			hasNextPage: true,
		});

		await expect(
			new ObjectsApiHelpers(makeApi({ listOwnedObjects })).fetchOwnedObjects({
				walletAddress: OWNER,
			})
		).resolves.toEqual([]);
		expect(listOwnedObjects).toHaveBeenCalledTimes(1);
	});

	it("fetches and casts single objects while wrapping transport errors", async () => {
		const object = makeObjectView({ objectId: OBJECT_2 });
		const getObject = jest
			.fn()
			.mockResolvedValueOnce({ object })
			.mockRejectedValueOnce(new Error("missing object"));
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(
			helper.fetchObject({ objectId: OBJECT_2, withDisplay: true })
		).resolves.toBe(object);
		expect(getObject).toHaveBeenNthCalledWith(1, {
			objectId: OBJECT_2,
			include: { json: true, display: true },
		});
		await expect(helper.fetchObject({ objectId: OBJECT_2 })).rejects.toThrow(
			"an error occured fetching object: missing object"
		);
		const castObject = makeObjectView({ objectId: OBJECT_1 });
		const castHelper = new ObjectsApiHelpers(
			makeApi({
				getObject: jest.fn().mockResolvedValue({ object: castObject }),
			})
		);
		await expect(
			castHelper.fetchCastObject({
				objectId: OBJECT_1,
				objectFromSuiObjectResponse: (value) => value.objectId,
			})
		).resolves.toBe(OBJECT_1);

		const customObject = makeObjectView({ objectId: OBJECT_3 });
		const customHelper = new ObjectsApiHelpers(
			makeApi({
				getObject: jest.fn().mockResolvedValue({ object: customObject }),
			})
		);
		await expect(
			customHelper.fetchCastObjectGeneral({
				objectId: OBJECT_3,
				include: { json: true, owner: true } as never,
				objectFromSuiObjectResponse: (value) => value.objectId,
			})
		).resolves.toBe(OBJECT_3);
	});

	it("batches at the 50-object boundary and drops per-object error arms", async () => {
		const objectIds = [
			"0x01",
			"0x02",
			"0x03",
			"0x04",
			"0x05",
			"0x06",
			"0x07",
			"0x08",
			"0x09",
			"0x0a",
			"0x0b",
			"0x0c",
			"0x0d",
			"0x0e",
			"0x0f",
			"0x10",
			"0x11",
			"0x12",
			"0x13",
			"0x14",
			"0x15",
			"0x16",
			"0x17",
			"0x18",
			"0x19",
			"0x1a",
			"0x1b",
			"0x1c",
			"0x1d",
			"0x1e",
			"0x1f",
			"0x20",
			"0x21",
			"0x22",
			"0x23",
			"0x24",
			"0x25",
			"0x26",
			"0x27",
			"0x28",
			"0x29",
			"0x2a",
			"0x2b",
			"0x2c",
			"0x2d",
			"0x2e",
			"0x2f",
			"0x30",
			"0x31",
			"0x32",
			"0x33",
		];
		const getObjects = jest
			.fn()
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_1 }), new Error("missing")],
			})
			.mockResolvedValueOnce({
				objects: [makeObjectView({ objectId: OBJECT_2 })],
			});
		const helper = new ObjectsApiHelpers(makeApi({ getObjects }));

		await expect(
			helper.fetchObjectBatch({ objectIds, withDisplay: true })
		).resolves.toEqual([
			makeObjectView({ objectId: OBJECT_1 }),
			makeObjectView({ objectId: OBJECT_2 }),
		]);
		expect(getObjects).toHaveBeenNthCalledWith(1, {
			objectIds: objectIds.slice(0, 50),
			include: { json: true, display: true },
		});
		expect(getObjects).toHaveBeenNthCalledWith(2, {
			objectIds: ["0x33"],
			include: { json: true, display: true },
		});
	});

	it("casts object batches and owned objects through caller-provided public casters", async () => {
		const object = makeObjectView({ objectId: OBJECT_1 });
		const getObjects = jest.fn().mockResolvedValue({ objects: [object] });
		const listOwnedObjects = jest.fn().mockResolvedValue({
			objects: [object],
			cursor: null,
			hasNextPage: false,
		});
		const helper = new ObjectsApiHelpers(
			makeApi({ getObjects, listOwnedObjects })
		);
		const caster = (value: SuiObjectView) => value.objectId;

		await expect(
			helper.fetchCastObjectBatch({
				objectIds: [OBJECT_1],
				objectFromSuiObjectResponse: caster,
			})
		).resolves.toEqual([OBJECT_1]);
		await expect(
			helper.fetchCastObjectsOwnedByAddressOfType({
				walletAddress: OWNER,
				objectType: KIOSK_CAP_TYPE,
				objectFromSuiObjectResponse: caster,
			})
		).resolves.toEqual([OBJECT_1]);
	});

	it("reshapes BCS object content and supports a caller deserializer", async () => {
		const object = makeObjectView({
			objectId: OBJECT_2,
			content: new Uint8Array([1, 2, 255]),
		});
		const getObject = jest.fn().mockResolvedValue({ object });
		const helper = new ObjectsApiHelpers(makeApi({ getObject }));

		await expect(helper.fetchObjectBcs(OBJECT_2)).resolves.toEqual({
			data: {
				objectId: OBJECT_2,
				version: "7",
				digest: "digest-1",
				type: `${PACKAGE_NFT}::collectible::Collectible`,
				owner: { AddressOwner: OWNER },
				bcs: {
					dataType: "moveObject",
					type: `${PACKAGE_NFT}::collectible::Collectible`,
					version: "7",
					bcsBytes: "AQL/",
				},
			},
		});
		expect(getObject).toHaveBeenCalledWith({
			objectId: OBJECT_2,
			include: { content: true },
		});
		const failedBcsHelper = new ObjectsApiHelpers(
			makeApi({ getObject: jest.fn().mockRejectedValue("bcs unavailable") })
		);
		await expect(failedBcsHelper.fetchObjectBcs(OBJECT_2)).rejects.toThrow(
			"an error occured fetching object: bcs unavailable"
		);

		const bcsType = {
			fromBase64: jest.fn().mockReturnValue(123n),
		} as unknown as BcsType<bigint>;
		await expect(
			helper.fetchCastObjectBcs({
				objectId: OBJECT_2,
				bcsType,
				fromDeserialized: (value) => `value:${value.toString()}`,
			})
		).resolves.toBe("value:123");
		expect(bcsType.fromBase64).toHaveBeenCalledWith("AQL/");
	});

	it("builds burn and public-share transaction commands through the Sui transaction boundary", async () => {
		const tx = new TransactionClass();
		const object = tx.object(OBJECT_1);
		await new ObjectsApiHelpers(makeApi({})).burnObjectTx({ tx, object });
		const burnCommand = tx.getData().commands[0];
		expect(burnCommand).toMatchObject({
			$kind: "TransferObjects",
			TransferObjects: {
				objects: [{ Input: 0, type: "object" }],
				address: { Input: 1, type: "pure" },
			},
		});

		const shareTx = new TransactionClass();
		await new ObjectsApiHelpers(makeApi({})).publicShareObjectTx({
			tx: shareTx,
			object: shareTx.object(OBJECT_1),
			objectType: `${PACKAGE_NFT}::collectible::Collectible`,
		});
		expect(shareTx.getData().commands[0]).toMatchObject({
			$kind: "MoveCall",
			MoveCall: {
				package:
					"0x0000000000000000000000000000000000000000000000000000000000000002",
				module: "transfer",
				function: "public_share_object",
				typeArguments: [`${PACKAGE_NFT}::collectible::Collectible`],
				arguments: [{ Input: 0, type: "object" }],
			},
		});
	});
});

describe("TransactionsApiHelpers", () => {
	it("queries transaction history through the optional JSON-RPC client with all required options", async () => {
		const queryTransactionBlocks = jest.fn().mockResolvedValue({
			data: [{ digest: "tx-1", effects: { status: { status: "success" } } }],
			nextCursor: undefined,
		});
		const api = makeApi({}, {}, { queryTransactionBlocks });
		const query = { filter: { FromAddress: OWNER } } as never;

		await expect(
			new TransactionsApiHelpers(api).fetchTransactionsWithCursor({
				query,
				cursor: "tx-cursor",
				limit: 12,
			})
		).resolves.toEqual({
			transactions: [
				{ digest: "tx-1", effects: { status: { status: "success" } } },
			],
			nextCursor: null,
		});
		expect(queryTransactionBlocks).toHaveBeenCalledWith({
			filter: { FromAddress: OWNER },
			cursor: "tx-cursor",
			limit: 12,
			options: {
				showEvents: true,
				showBalanceChanges: true,
				showEffects: true,
				showObjectChanges: true,
				showInput: true,
			},
		});
	});

	it("uses failed simulation effects when assigning a bigint gas budget and reference price", async () => {
		const build = jest.fn().mockResolvedValue(new Uint8Array([1, 2]));
		const setGasBudget = jest.fn();
		const setGasPrice = jest.fn();
		const tx = { build, setGasBudget, setGasPrice } as unknown as Transaction;
		const simulateTransaction = jest.fn().mockResolvedValue({
			$kind: "FailedTransaction",
			FailedTransaction: {
				effects: {
					gasUsed: { computationCost: "70", storageCost: "5" },
				},
			},
		});
		const getReferenceGasPrice = jest
			.fn()
			.mockResolvedValue({ referenceGasPrice: "12" });
		const helper = new TransactionsApiHelpers(
			makeApi({ simulateTransaction, getReferenceGasPrice })
		);

		await expect(helper.fetchSetGasBudgetForTx({ tx })).resolves.toBe(tx);
		expect(build).toHaveBeenCalledWith({ client: expect.anything() });
		expect(simulateTransaction).toHaveBeenCalledWith({
			transaction: new Uint8Array([1, 2]),
			include: { effects: true },
		});
		expect(setGasBudget).toHaveBeenCalledWith(82n);
		expect(setGasPrice).toHaveBeenCalledWith(12n);
	});

	it("serializes sponsored transactions without simulating them and simulates non-sponsored ones", async () => {
		const sponsored = {
			toJSON: jest.fn().mockReturnValue("sponsored-json"),
		} as unknown as Transaction;
		const api = makeApi({});
		const helper = new TransactionsApiHelpers(api);
		await expect(
			helper.fetchSetGasBudgetAndSerializeTx({
				tx: Promise.resolve(sponsored),
				isSponsoredTx: true,
			})
		).resolves.toBe("sponsored-json");

		const adjusted = {
			toJSON: jest.fn().mockReturnValue("adjusted-json"),
		} as unknown as Transaction;
		const adjust = jest
			.spyOn(helper, "fetchSetGasBudgetForTx")
			.mockResolvedValue(adjusted);
		const original = { toJSON: jest.fn() } as unknown as Transaction;
		await expect(
			helper.fetchSetGasBudgetAndSerializeTx({ tx: Promise.resolve(original) })
		).resolves.toBe("adjusted-json");
		expect(adjust).toHaveBeenCalledWith({ tx: original });
		expect(original.toJSON).not.toHaveBeenCalled();
	});

	it("returns an optional base64 transaction kind and asks the transaction for kind-only bytes", async () => {
		const build = jest.fn().mockResolvedValue(new Uint8Array([0, 255, 65]));
		const tx = { build } as unknown as Transaction;
		const client = { clientMarker: true };
		const helper = new TransactionsApiHelpers(makeApi(client));

		await expect(helper.fetchBase64TxKindFromTx({ tx })).resolves.toBe("AP9B");
		await expect(
			helper.fetchBase64TxKindFromTx({ tx: undefined })
		).resolves.toBeUndefined();
		expect(build).toHaveBeenCalledWith({ client, onlyTransactionKind: true });
	});

	it("creates transaction targets and builders with the supplied wallet sender", () => {
		expect(
			TransactionsApiHelpers.createTxTarget("0xpackage", "module", "entry")
		).toBe("0xpackage::module::entry");

		let received: { walletAddress: string; value: number } | undefined;
		const builder = TransactionsApiHelpers.createBuildTxFunc(
			(inputs: { tx: Transaction; walletAddress: string; value: number }) => {
				received = inputs;
				return inputs.tx.pure.u64(inputs.value);
			}
		);
		const tx = builder({ walletAddress: OWNER, value: 7 });

		expect(received?.walletAddress).toBe(OWNER);
		expect(received?.value).toBe(7);
		expect(tx.getData().sender).toBe(OWNER);
	});

	it("builds the split-coin call with an object argument and u64 amount", () => {
		const moveCall = jest.fn().mockReturnValue("split-result");
		const object = jest.fn().mockReturnValue("coin-argument");
		const pure = { u64: jest.fn().mockReturnValue("amount-argument") };
		const tx = { moveCall, object, pure } as unknown as Transaction;

		expect(
			TransactionsApiHelpers.splitCoinTx({
				tx,
				coinType: "0x2::sui::SUI",
				coinId: OBJECT_1,
				amount: 123n,
			})
		).toBe("split-result");
		expect(object).toHaveBeenCalledWith(OBJECT_1);
		expect(pure.u64).toHaveBeenCalledWith(123n);
		expect(moveCall).toHaveBeenCalledWith({
			target: "0x2::coin::split",
			typeArguments: ["0x2::sui::SUI"],
			arguments: ["coin-argument", "amount-argument"],
		});
	});

	it("converts service coin data across input, result, nested-result, gas, and object-id forms", () => {
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: "0x2::sui::SUI",
			})
		).toEqual({
			Coin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
		});
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { Input: 3 },
			})
		).toEqual({ Input: 3 });
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "NestedResult", NestedResult: [2, 1] },
			} as never)
		).toEqual({ NestedResult: [2, 1] });
		expect(
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "Result", Result: 4 },
			} as never)
		).toEqual({ Result: 4 });
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "GasCoin", GasCoin: true } as never,
			})
		).toThrow("unable to convert gas coin arg to service coin data");
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { GasCoin: true } as never,
			})
		).toThrow("unable to convert gas coin arg to service coin data");
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataFromCoinTxArg({
				coinTxArg: { $kind: "Unexpected" } as never,
			})
		).toThrow("unexpected coinTxArg.$kind: Unexpected");

		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { GasCoin: true },
			} as never)
		).toBe("Gas");
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "Input", Input: 5 },
			} as never)
		).toEqual({ Input: 5 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { Result: 6 },
			} as never)
		).toEqual({ Result: 6 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { NestedResult: [4, 2] },
			} as never)
		).toEqual({ NestedResult: [4, 2] });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { Input: 8 },
			} as never)
		).toEqual({ Input: 8 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "Result", Result: 9 },
			} as never)
		).toEqual({ Result: 9 });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "NestedResult", NestedResult: [5, 1] },
			} as never)
		).toEqual({ NestedResult: [5, 1] });
		expect(
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { $kind: "GasCoin", GasCoin: true },
			} as never)
		).toBe("Gas");
		expect(() =>
			TransactionsApiHelpers.serviceCoinDataV2FromCoinTxArg({
				coinTxArg: { Unsupported: true } as never,
			})
		).toThrow("coinTxArg in format [object Object] not supported");

		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { Input: 5 },
			})
		).toEqual({ Input: 5 });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { NestedResult: [2, 1] },
			})
		).toEqual({ NestedResult: [2, 1] });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { Result: 6 },
			})
		).toEqual({ Result: 6 });
		expect(() =>
			TransactionsApiHelpers.coinTxArgFromServiceCoinData({
				serviceCoinData: { Coin: OBJECT_1 },
			})
		).toThrow("serviceCoinData in format { Coin: ObjectId } not supported");

		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: "Gas",
			})
		).toEqual({ GasCoin: true });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { Result: 2 },
			})
		).toEqual({ Result: 2 });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { NestedResult: [3, 0] },
			})
		).toEqual({ NestedResult: [3, 0] });
		expect(
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { Input: 4 },
			})
		).toEqual({ Input: 4 });
		expect(() =>
			TransactionsApiHelpers.coinTxArgFromServiceCoinDataV2({
				serviceCoinDataV2: { Result: [3, 0] } as never,
			})
		).toThrow('serviceCoinDataV2 format {"Result":[3,0]} not supported');
	});

	it("transfers transaction metadata while preserving valid bigint gas values", () => {
		const initTx = {
			getData: jest.fn().mockReturnValue({
				sender: OWNER,
				expiration: { Epoch: 9 },
				gasData: {
					budget: 101n,
					owner: "0xgas-owner",
					payment: [{ objectId: OBJECT_1 }],
					price: 3n,
				},
			}),
		} as unknown as Transaction;
		const newTx = {
			setSender: jest.fn(),
			setExpiration: jest.fn(),
			setGasBudget: jest.fn(),
			setGasOwner: jest.fn(),
			setGasPayment: jest.fn(),
			setGasPrice: jest.fn(),
		} as unknown as Transaction;

		TransactionsApiHelpers.transferTxMetadata({ initTx, newTx });
		expect(newTx.setSender).toHaveBeenCalledWith(OWNER);
		expect(newTx.setExpiration).toHaveBeenCalledWith({ Epoch: 9 });
		expect(newTx.setGasBudget).toHaveBeenCalledWith(101n);
		expect(newTx.setGasOwner).toHaveBeenCalledWith("0xgas-owner");
		expect(newTx.setGasPayment).toHaveBeenCalledWith([{ objectId: OBJECT_1 }]);
		expect(newTx.setGasPrice).toHaveBeenCalledWith(3n);
	});
});

describe("NftsApi and NftsApiCasting", () => {
	const nftObject = makeObjectView({
		objectId: OBJECT_1,
		type: `${PACKAGE_NFT}::collectible::Collectible`,
		display: {
			output: {
				name: "Moon Cat",
				image_url: "https://images.test/moon-cat.png",
				rarity: "rare",
			},
			errors: null,
		},
	});

	it("normalizes display fields into suggested and other NFT data and filters unrenderable objects", () => {
		const emptyDisplay = makeObjectView({
			objectId: OBJECT_2,
			display: { output: {}, errors: null },
		});
		const noDisplay = makeObjectView({ objectId: OBJECT_3, display: null });

		expect(
			NftsApiCasting.nftsFromSuiObjects([nftObject, emptyDisplay, noDisplay])
		).toEqual([
			{
				info: {
					objectId: OBJECT_1,
					objectType: `${PACKAGE_NFT}::collectible::Collectible`,
				},
				display: {
					suggested: {
						name: "Moon Cat",
						imageUrl: "https://images.test/moon-cat.png",
					},
					other: { rarity: "rare" },
				},
			},
		]);
	});

	it("returns empty display maps for display errors and rejects objects without identity", () => {
		const errorDisplay = makeObjectView({
			display: { output: null, errors: [{ key: "name" }] },
		});
		expect(NftsApiCasting.nftFromSuiObject(errorDisplay)).toEqual({
			info: {
				objectId: OBJECT_1,
				objectType: `${PACKAGE_NFT}::collectible::Collectible`,
			},
			display: { suggested: {}, other: {} },
		});
		expect(() =>
			NftsApiCasting.nftFromSuiObject(
				makeObjectView({ objectId: undefined, type: undefined })
			)
		).toThrow("no object type found on undefined");
	});

	it("casts regular and personal kiosk owner caps from their gRPC field shapes", () => {
		const regular = makeObjectView({
			objectId: OBJECT_1,
			type: KIOSK_CAP_TYPE,
			json: { for: OBJECT_2 },
		});
		const personal = makeObjectView({
			objectId: OBJECT_2,
			type: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
			json: { cap: { for: OBJECT_3 } },
		});

		expect(NftsApiCasting.kioskOwnerCapFromSuiObject(regular)).toEqual({
			objectId: OBJECT_1,
			objectType: KIOSK_CAP_TYPE,
			kioskObjectId: OBJECT_2,
		});
		expect(
			NftsApiCasting.kioskOwnerCapFromPersonalKioskCapSuiObject(personal)
		).toEqual({
			objectId: OBJECT_2,
			objectType: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
			kioskObjectId: OBJECT_3,
		});
	});

	it("requires NFT addresses and derives the personal kiosk cap type", () => {
		const missingApi = makeApi({});
		expect(() => new NftsApi(missingApi)).toThrow(
			"not all required addresses have been set in provider"
		);

		const nftsAddress = { packages: { mystenTransferPolicy: PACKAGE_NFT } };
		const api = makeApi({}, { nfts: nftsAddress });
		const nfts = new NftsApi(api);
		expect(nfts.addresses).toEqual(nftsAddress);
		expect(nfts.objectTypes.personalKioskCap).toBe(
			`${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`
		);
	});

	it("routes NFT and kiosk reads through the low-level API and asks for display data", async () => {
		const ownedObjects = jest.fn().mockResolvedValue([nftObject]);
		const objectBatch = jest.fn().mockResolvedValue([nftObject]);
		const ownedCaps = jest
			.fn()
			.mockImplementation(
				({
					objectType,
					objectFromSuiObjectResponse,
				}: {
					objectType: string;
					objectFromSuiObjectResponse: (value: SuiObjectView) => unknown;
				}) =>
					Promise.resolve([
						objectFromSuiObjectResponse(
							objectType === `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`
								? makeObjectView({
										objectId: OBJECT_2,
										type: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
										json: { cap: { for: OBJECT_3 } },
									})
								: makeObjectView({
										objectId: OBJECT_1,
										type: KIOSK_CAP_TYPE,
										json: { for: OBJECT_2 },
									})
						),
					])
			);
		const dynamicObjects = jest
			.fn()
			.mockResolvedValue([
				{ info: { objectId: OBJECT_3 }, display: { suggested: {}, other: {} } },
			]);
		const objects = {
			fetchOwnedObjects: ownedObjects,
			fetchObjectBatch: objectBatch,
			fetchCastObjectsOwnedByAddressOfType: ownedCaps,
			fetchCastObjectBatch: jest.fn().mockResolvedValue([
				{
					objectId: OBJECT_1,
					objectType: KIOSK_CAP_TYPE,
					kioskObjectId: OBJECT_2,
				},
			]),
		};
		const dynamicFields = { fetchCastAllDynamicFieldsOfType: dynamicObjects };
		const api = {
			addresses: { nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } } },
			Objects: () => objects,
			DynamicFields: () => dynamicFields,
		} as unknown as AftermathApiType;
		const nfts = new NftsApi(api);

		await expect(
			nfts.fetchOwnedNfts({ walletAddress: OWNER })
		).resolves.toHaveLength(1);
		expect(ownedObjects).toHaveBeenCalledWith({
			walletAddress: OWNER,
			withDisplay: true,
		});
		await expect(
			nfts.fetchNfts({ objectIds: [OBJECT_1] })
		).resolves.toHaveLength(1);
		expect(objectBatch).toHaveBeenCalledWith({
			objectIds: [OBJECT_1],
			withDisplay: true,
		});

		await expect(
			nfts.fetchOwnedKioskOwnerCaps({ walletAddress: OWNER })
		).resolves.toEqual([
			{
				objectId: OBJECT_1,
				objectType: KIOSK_CAP_TYPE,
				kioskObjectId: OBJECT_2,
			},
			{
				objectId: OBJECT_2,
				objectType: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
				kioskObjectId: OBJECT_3,
			},
		]);
		expect(ownedCaps).toHaveBeenCalledTimes(2);
		expect(ownedCaps.mock.calls[0]?.[0]).toMatchObject({
			walletAddress: OWNER,
			objectType: KIOSK_CAP_TYPE,
		});
		expect(ownedCaps.mock.calls[1]?.[0]).toMatchObject({
			walletAddress: OWNER,
			objectType: `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`,
		});

		await expect(
			nfts.fetchNftsInKiosk({ kioskObjectId: OBJECT_2 })
		).resolves.toHaveLength(1);
		expect(dynamicObjects).toHaveBeenCalledWith({
			parentObjectId: OBJECT_2,
			objectsFromObjectIds: expect.any(Function),
		});

		await expect(
			nfts.fetchKioskOwnerCaps({ kioskOwnerCapIds: [OBJECT_1] })
		).resolves.toEqual([
			{
				objectId: OBJECT_1,
				objectType: KIOSK_CAP_TYPE,
				kioskObjectId: OBJECT_2,
			},
		]);
	});

	it("materializes kiosk objects and personal-kiosk flags from owner caps", async () => {
		const personalType = `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`;
		const caps = [
			{
				objectId: OBJECT_1,
				objectType: KIOSK_CAP_TYPE,
				kioskObjectId: OBJECT_2,
			},
			{ objectId: OBJECT_2, objectType: personalType, kioskObjectId: OBJECT_3 },
		];
		const api = {
			addresses: { nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } } },
			Objects: () => ({ fetchCastObjectBatch: jest.fn() }),
			DynamicFields: () => ({ fetchCastAllDynamicFieldsOfType: jest.fn() }),
		} as unknown as AftermathApiType;
		const nfts = new NftsApi(api);
		jest
			.spyOn(nfts, "fetchNftsInKiosk")
			.mockResolvedValueOnce([
				{
					info: { objectId: OBJECT_2, objectType: "nft" },
					display: { suggested: {}, other: {} },
				},
			])
			.mockResolvedValueOnce([]);

		await expect(nfts.fetchKiosks({ kioskOwnerCaps: caps })).resolves.toEqual([
			{
				objectId: OBJECT_2,
				objectType: KIOSK_TYPE,
				kioskOwnerCapId: OBJECT_1,
				nfts: [
					{
						info: { objectId: OBJECT_2, objectType: "nft" },
						display: { suggested: {}, other: {} },
					},
				],
				isPersonal: false,
			},
			{
				objectId: OBJECT_3,
				objectType: KIOSK_TYPE,
				kioskOwnerCapId: OBJECT_2,
				nfts: [],
				isPersonal: true,
			},
		]);
	});

	it("delegates kiosk collection wrappers through owner-cap and dynamic-field readers", async () => {
		const personalType = `${PACKAGE_NFT}::personal_kiosk::PersonalKioskCap`;
		const firstCap = {
			objectId: OBJECT_1,
			objectType: KIOSK_CAP_TYPE,
			kioskObjectId: OBJECT_2,
		};
		const caps = [
			firstCap,
			{ objectId: OBJECT_2, objectType: personalType, kioskObjectId: OBJECT_3 },
		];
		const api = {
			addresses: { nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } } },
			Objects: () => ({ fetchCastObjectBatch: jest.fn() }),
			DynamicFields: () => ({ fetchCastAllDynamicFieldsOfType: jest.fn() }),
		} as unknown as AftermathApiType;
		const nfts = new NftsApi(api);
		const fetchedKioskOwnerCaps = jest
			.spyOn(nfts, "fetchKioskOwnerCaps")
			.mockResolvedValue(caps);
		const kioskResult = [{ objectId: OBJECT_2 }];
		const fetchedKiosks = jest
			.spyOn(nfts, "fetchKiosks")
			.mockResolvedValue(kioskResult as never);

		await expect(
			nfts.fetchKiosksFromOwnerCaps({ kioskOwnerCapIds: [OBJECT_1, OBJECT_2] })
		).resolves.toBe(kioskResult);
		expect(fetchedKioskOwnerCaps).toHaveBeenCalledWith({
			kioskOwnerCapIds: [OBJECT_1, OBJECT_2],
		});
		expect(fetchedKiosks).toHaveBeenCalledWith({ kioskOwnerCaps: caps });

		const fetchedOwnedCaps = jest
			.spyOn(nfts, "fetchOwnedKioskOwnerCaps")
			.mockResolvedValue([firstCap]);
		const fetchedNftsInKiosk = jest
			.spyOn(nfts, "fetchNftsInKiosk")
			.mockResolvedValue([]);
		await expect(
			nfts.fetchOwnedKiosks({ walletAddress: OWNER })
		).resolves.toEqual([
			{
				objectId: OBJECT_2,
				objectType: KIOSK_TYPE,
				kioskOwnerCapId: OBJECT_1,
				nfts: [],
				isPersonal: false,
			},
		]);
		expect(fetchedOwnedCaps).toHaveBeenCalledWith({ walletAddress: OWNER });
		expect(fetchedNftsInKiosk).toHaveBeenCalledWith({
			kioskObjectId: OBJECT_2,
		});
	});
});

describe("WalletApi", () => {
	it("normalizes coin types and returns exact bigint balances", async () => {
		const getBalance = jest
			.fn()
			.mockResolvedValue({ balance: { balance: "9007199254740993123" } });
		const api = makeApi({ getBalance });

		await expect(
			new WalletApi(api).fetchCoinBalance({
				walletAddress: OWNER,
				coin: "0x2::sui::SUI",
			})
		).resolves.toBe(9007199254740993123n);
		expect(getBalance).toHaveBeenCalledWith({
			owner: OWNER,
			coinType: "0x2::sui::SUI",
		});
	});

	it("pages all coin balances and normalizes returned coin keys", async () => {
		const listBalances = jest
			.fn()
			.mockResolvedValueOnce({
				balances: [{ coinType: "0x2::sui::SUI", balance: "1000000000" }],
				cursor: "balance-cursor",
				hasNextPage: true,
			})
			.mockResolvedValueOnce({
				balances: [{ coinType: "0xabc::coin::COIN", balance: "7" }],
				cursor: null,
				hasNextPage: false,
			});
		const api = makeApi({ listBalances });

		await expect(
			new WalletApi(api).fetchAllCoinBalances({ walletAddress: OWNER })
		).resolves.toEqual({
			"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI":
				1000000000n,
			"0x0000000000000000000000000000000000000000000000000000000000000abc::coin::COIN":
				7n,
		});
		expect(listBalances).toHaveBeenNthCalledWith(1, {
			owner: OWNER,
			cursor: undefined,
		});
		expect(listBalances).toHaveBeenNthCalledWith(2, {
			owner: OWNER,
			cursor: "balance-cursor",
		});
	});

	it("routes wallet transaction history through Transactions with the wallet filter", async () => {
		const fetchTransactionsWithCursor = jest.fn().mockResolvedValue({
			transactions: [{ digest: "tx-1" }],
			nextCursor: null,
		});
		const api = {
			Transactions: () => ({ fetchTransactionsWithCursor }),
		} as unknown as AftermathApiType;

		await expect(
			new WalletApi(api).fetchPastTransactions({
				walletAddress: OWNER,
				cursor: "cursor-1",
				limit: 8,
			})
		).resolves.toEqual({
			transactions: [{ digest: "tx-1" }],
			nextCursor: null,
		});
		expect(fetchTransactionsWithCursor).toHaveBeenCalledWith({
			query: { filter: { FromAddress: OWNER } },
			cursor: "cursor-1",
			limit: 8,
		});
	});
});

describe("AftermathApi and Aftermath provider construction", () => {
	it("constructs general low-level helpers around one client and preserves optional JSON-RPC selection", () => {
		const client = { clientMarker: true };
		const jsonRpcClient = { jsonRpcMarker: true };
		const addresses: ConfigAddresses = {
			nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } },
		};
		const api = makeApi(client, addresses, jsonRpcClient);

		expect(api.client).toBe(client);
		expect(api.addresses).toBe(addresses);
		expect(api.requireJsonRpcClient("test seam")).toBe(jsonRpcClient);
		expect(api.DynamicFields()).toBeInstanceOf(DynamicFieldsApiHelpers);
		expect(api.Events()).toBeInstanceOf(EventsApiHelpers);
		expect(api.Inspections()).toBeInstanceOf(InspectionsApiHelpers);
		expect(api.Objects()).toBeInstanceOf(ObjectsApiHelpers);
		expect(api.Transactions()).toBeInstanceOf(TransactionsApiHelpers);
		expect(api.Wallet()).toBeInstanceOf(WalletApi);
		expect(api.Nfts()).toBeInstanceOf(NftsApi);
	});

	it("describes the missing JSON-RPC dependency at the public boundary", () => {
		const api = makeApi({});
		expect(() =>
			api.requireJsonRpcClient("Events().fetchCastEventsWithCursor")
		).toThrow(
			"Events().fetchCastEventsWithCursor requires a `SuiJsonRpcClient`"
		);
	});

	it("uses a prebuilt API without address discovery or Sui network calls", async () => {
		const addresses: ConfigAddresses = {
			nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } },
		};
		const api = makeApi({}, addresses);
		const calls = installFetchHandler(() => {
			throw new Error("prebuilt API path must not fetch");
		});

		const aftermath = await Aftermath.create({ api, network: "TESTNET" });
		expect(calls).toHaveLength(0);
		expect(aftermath.network).toBe("TESTNET");
		expect(aftermath.getApiBaseUrl()).toBe("https://testnet.aftermath.finance");
		expect(aftermath.Wallet(OWNER)).toMatchObject({ address: OWNER, api });
		expect(aftermath.Prices()).toBeInstanceOf(Prices);
		expect(aftermath.DynamicGas()).toBeInstanceOf(DynamicGas);
		expect(aftermath.Sui().api).toBe(api);
		expect(aftermath.Coin().api).toBe(api);
		expect(aftermath.Router().config).toBe(aftermath.config);
		expect(aftermath.Referrals().config).toBe(aftermath.config);
		expect(aftermath.Dca().config).toBe(aftermath.config);
		expect(aftermath.LimitOrders().config).toBe(aftermath.config);
		expect(aftermath.UserData().config).toBe(aftermath.config);
		expect((aftermath.Auth() as { config: unknown }).config).toBe(
			aftermath.config
		);
	});

	it("forwards Move-error translation through the configured low-level API", async () => {
		const api = makeApi({});
		const translation = {
			errorCode: 7,
			packageId: PACKAGE_NFT,
			module: "collectible",
			error: "not transferable",
		};
		const translateMoveErrorMessage = jest
			.spyOn(api, "translateMoveErrorMessage")
			.mockReturnValue(translation);
		const aftermath = await Aftermath.create({ api });

		expect(
			aftermath.translateMoveErrorMessage({ errorMessage: "MoveAbort(7)" })
		).toBe(translation);
		expect(translateMoveErrorMessage).toHaveBeenCalledWith({
			errorMessage: "MoveAbort(7)",
		});
	});

	it("discovers addresses through the configured API endpoint and constructs the requested network provider", async () => {
		const calls = installFetch({
			nfts: { packages: { mystenTransferPolicy: PACKAGE_NFT } },
		});
		const signal = new AbortController().signal;

		const aftermath = await Aftermath.create(
			{
				baseUrl: "https://sdk.test/",
				network: "DEVNET",
				fullnodeUrl: "https://fullnode.test",
			},
			signal
		);
		expect(aftermath.network).toBe("DEVNET");
		expect(aftermath.getApiBaseUrl()).toBe("https://sdk.test/");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.input).toBe("https://sdk.test/api//addresses");
		expect(calls[0]?.init?.signal).toBe(signal);
	});

	it("keeps preloaded-address construction network-free and routes custom API endpoints", async () => {
		const calls = installFetchHandler(() => {
			throw new Error("preloaded addresses must not fetch");
		});
		const aftermath = await Aftermath.create({
			baseUrl: "https://sdk.test/",
			apiEndpoint: "gateway",
			addresses: {},
		});

		expect(calls).toHaveLength(0);
		expect(aftermath.getApiBaseUrl()).toBe("https://sdk.test/");
		const addressCalls = installFetch({});
		await expect(aftermath.getAddresses()).resolves.toEqual({});
		expect(addressCalls[0]?.input).toBe("https://sdk.test/gateway//addresses");
	});
});
