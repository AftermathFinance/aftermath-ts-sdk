import { Transaction } from "@mysten/sui/transactions";

import type { AftermathApi } from "../src/general/providers/aftermathApi";
import { isAftermathTransportError } from "../src/general/utils/transportError";
import { RouterApi } from "../src/packages/router/api/routerApi";
import { RouterApiCasting } from "../src/packages/router/api/routerApiCasting";
import type { RouterTradeEventOnChain } from "../src/packages/router/api/routerApiCastingTypes";
import { Router } from "../src/packages/router/router";
import type {
	RouterCompleteTradeRoute,
	RouterProtocolName,
} from "../src/packages/router/routerTypes";

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const BASE_URL = "https://sdk.test/";
const SUI = "0x2::sui::SUI";
const USDC = "0xabc::usdc::USDC";
const WALLET = "0x123";
const REFERRER = "0x456";
const FEE_RECIPIENT = "0xfee";
const CETUS_POOL = "0xcetus-pool";
const DEEPBOOK_POOL = "0xdeepbook-pool";
const ROUTER_UTILS_PACKAGE = "0xrouter-utils";
const TRADE_EVENT_TYPE = "0xrouter-utils::events::SwapCompletedEvent";

const EMPTY_SERIALIZED_TRANSACTION =
	'{"version":1,"expiration":null,"gasConfig":{},"inputs":[],"transactions":[]}';
const PADDED_WALLET =
	"0x0000000000000000000000000000000000000000000000000000000000000123";

const routeResponseWire = {
	coinIn: {
		type: SUI,
		amount: "9007199254740993n",
		tradeFee: "17n",
	},
	coinOut: {
		type: USDC,
		amount: "12345678901234567890n",
		tradeFee: "23n",
	},
	spotPrice: 1.2345,
	routes: [
		{
			coinIn: {
				type: SUI,
				amount: "9007199254740993n",
				tradeFee: "17n",
			},
			coinOut: {
				type: USDC,
				amount: "12345678901234567890n",
				tradeFee: "23n",
			},
			spotPrice: 1.2345,
			portion: "1000000000000000000n",
			paths: [
				{
					protocolName: "Cetus" as RouterProtocolName,
					poolId: CETUS_POOL,
					poolMetadata: { protocol: "Cetus", feeTier: 2000 },
					coinIn: {
						type: SUI,
						amount: "4503599627370496n",
						tradeFee: "8n",
					},
					coinOut: {
						type: USDC,
						amount: "6172839456789012345n",
						tradeFee: "11n",
					},
					spotPrice: 1.2344,
				},
				{
					protocolName: "DeepBookV3" as RouterProtocolName,
					poolId: DEEPBOOK_POOL,
					poolMetadata: { protocol: "DeepBookV3", takerFeeBps: 4 },
					coinIn: {
						type: SUI,
						amount: "4503599627370497n",
						tradeFee: "9n",
					},
					coinOut: {
						type: USDC,
						amount: "6172839456789012346n",
						tradeFee: "12n",
					},
					spotPrice: 1.2346,
				},
			],
		},
	],
	netTradeFeePercentage: 0.003,
	referrer: REFERRER,
	externalFee: { recipient: FEE_RECIPIENT, feePercentage: 0.005 },
	slippage: 0.0125,
};

const completeRoute: RouterCompleteTradeRoute = {
	coinIn: {
		type: SUI,
		amount: 9007199254740993n,
		tradeFee: 17n,
	},
	coinOut: {
		type: USDC,
		amount: 12345678901234567890n,
		tradeFee: 23n,
	},
	spotPrice: 1.2345,
	routes: [
		{
			coinIn: {
				type: SUI,
				amount: 9007199254740993n,
				tradeFee: 17n,
			},
			coinOut: {
				type: USDC,
				amount: 12345678901234567890n,
				tradeFee: 23n,
			},
			spotPrice: 1.2345,
			portion: 1000000000000000000n,
			paths: [
				{
					protocolName: "Cetus",
					poolId: CETUS_POOL,
					poolMetadata: { protocol: "Cetus", feeTier: 2000 },
					coinIn: {
						type: SUI,
						amount: 4503599627370496n,
						tradeFee: 8n,
					},
					coinOut: {
						type: USDC,
						amount: 6172839456789012345n,
						tradeFee: 11n,
					},
					spotPrice: 1.2344,
				},
				{
					protocolName: "DeepBookV3",
					poolId: DEEPBOOK_POOL,
					poolMetadata: { protocol: "DeepBookV3", takerFeeBps: 4 },
					coinIn: {
						type: SUI,
						amount: 4503599627370497n,
						tradeFee: 9n,
					},
					coinOut: {
						type: USDC,
						amount: 6172839456789012346n,
						tradeFee: 12n,
					},
					spotPrice: 1.2346,
				},
			],
		},
	],
	netTradeFeePercentage: 0.003,
	referrer: REFERRER,
	externalFee: { recipient: FEE_RECIPIENT, feePercentage: 0.005 },
	slippage: 0.0125,
};

const eventResponseWire = [
	{
		type: TRADE_EVENT_TYPE,
		timestamp: 1_700_000_000_123,
		txnDigest: "digest-1",
		trader: WALLET,
		coinInType: SUI,
		coinInAmount: "9007199254740993n",
		coinOutType: USDC,
		coinOutAmount: "12345678901234567890n",
	},
	{
		type: TRADE_EVENT_TYPE,
		timestamp: null,
		txnDigest: "digest-2",
		trader: WALLET,
		coinInType: SUI,
		coinInAmount: "0n",
		coinOutType: USDC,
		coinOutAmount: "1n",
	},
];

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function installResponse(body: string, init: ResponseInit = {}): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, requestInit) => {
		calls.push({ input, init: requestInit });
		return Promise.resolve(
			new Response(body, {
				status: 200,
				...init,
			})
		);
	}) as typeof fetch;
	return calls;
}

function installJsonResponse(
	payload: unknown,
	init?: ResponseInit
): FetchCall[] {
	return installResponse(JSON.stringify(payload), init);
}

function installRejectedFetch(error: unknown): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, requestInit) => {
		calls.push({ input, init: requestInit });
		return Promise.reject(error);
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

describe("Router public HTTP seam", () => {
	it("exposes the documented fee constant", () => {
		expect(Router.constants.maxExternalFeePercentage).toBe(0.5);
	});

	it("maps volume and supported-coin reads to the router paths", async () => {
		const router = new Router({ baseUrl: BASE_URL, accessToken: "test-token" });

		const volumeCalls = installResponse("1234567.89");
		expect(await router.getVolume24hrs()).toBe(1_234_567.89);
		expect(volumeCalls[0]?.input).toBe(
			"https://sdk.test/api/router/volume-24hrs"
		);
		expect(volumeCalls[0]?.init).toEqual({
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer test-token",
			},
			signal: undefined,
		});

		const supportedCoins = [SUI, USDC];
		const coinCalls = installJsonResponse(supportedCoins);
		expect(await router.getSupportedCoins()).toEqual(supportedCoins);
		expect(coinCalls[0]?.input).toBe(
			"https://sdk.test/api/router/supported-coins"
		);
		expect(coinCalls[0]?.init?.method).toBeUndefined();
		expect(coinCalls[0]?.init?.body).toBeUndefined();
	});

	it("searches supported coins with the literal filter path and abort signal", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const signal = new AbortController().signal;
		const calls = installJsonResponse([SUI]);

		expect(
			await router.searchSupportedCoins({ filter: "0x2::sui::SUI" }, signal)
		).toEqual([SUI]);
		expect(calls[0]?.input).toBe(
			"https://sdk.test/api/router/supported-coins/0x2::sui::SUI"
		);
		expect(calls[0]?.init).toMatchObject({
			headers: { "Content-Type": "application/json" },
			signal,
		});
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.body).toBeUndefined();
	});

	it("maps an amount-in route and round-trips protocol, fee, and bigint fields", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const signal = new AbortController().signal;
		const calls = installJsonResponse(routeResponseWire);
		const input = {
			coinInType: SUI,
			coinOutType: USDC,
			coinInAmount: 9223372036854775807n,
			referrer: REFERRER,
			externalFee: { recipient: FEE_RECIPIENT, feePercentage: 0.5 },
			protocolBlacklist: ["Cetus", "DeepBookV3"] as RouterProtocolName[],
			poolBlacklist: [CETUS_POOL],
		};

		const result = await router.getCompleteTradeRouteGivenAmountIn(
			input,
			signal
		);

		expect(requestBody(calls)).toEqual({
			coinInType: SUI,
			coinOutType: USDC,
			coinInAmount: "9223372036854775807n",
			referrer: REFERRER,
			externalFee: { recipient: FEE_RECIPIENT, feePercentage: 0.5 },
			protocolBlacklist: ["Cetus", "DeepBookV3"],
			poolBlacklist: [CETUS_POOL],
		});
		expect(calls[0]?.input).toBe("https://sdk.test/api/router/trade-route");
		expect(calls[0]?.init?.method).toBe("POST");
		expect(calls[0]?.init?.signal).toBe(signal);

		expect(result.coinIn).toEqual({
			type: SUI,
			amount: 9007199254740993n,
			tradeFee: 17n,
		});
		expect(result.coinOut.amount).toBe(12345678901234567890n);
		expect(result.routes[0]?.portion).toBe(1000000000000000000n);
		expect(result.routes[0]?.paths.map((path) => path.protocolName)).toEqual([
			"Cetus",
			"DeepBookV3",
		]);
		expect(result.routes[0]?.paths[0]?.poolMetadata).toEqual({
			protocol: "Cetus",
			feeTier: 2000,
		});
		expect(result.externalFee).toEqual({
			recipient: FEE_RECIPIENT,
			feePercentage: 0.005,
		});
	});

	it("maps an amount-out route without dropping zero slippage or whitelist filters", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const calls = installJsonResponse({ ...routeResponseWire, slippage: 0 });

		const result = await router.getCompleteTradeRouteGivenAmountOut({
			coinInType: SUI,
			coinOutType: USDC,
			coinOutAmount: 0n,
			slippage: 0,
			protocolWhitelist: ["Aftermath", "Cetus"],
			poolWhitelist: [DEEPBOOK_POOL],
		});

		expect(requestBody(calls)).toEqual({
			coinInType: SUI,
			coinOutType: USDC,
			coinOutAmount: "0n",
			slippage: 0,
			protocolWhitelist: ["Aftermath", "Cetus"],
			poolWhitelist: [DEEPBOOK_POOL],
		});
		expect(result.slippage).toBe(0);
		expect(result.routes[0]?.paths[1]?.protocolName).toBe("DeepBookV3");
	});

	it("builds a transaction request with bigint route fields and binds the wallet sender", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const calls = installJsonResponse(EMPTY_SERIALIZED_TRANSACTION);

		const tx = await router.getTransactionForCompleteTradeRoute({
			walletAddress: WALLET,
			completeRoute,
			slippage: 0.01,
			isSponsoredTx: true,
			customRecipient: "0xrecipient",
		});

		expect(calls[0]?.input).toBe(
			"https://sdk.test/api/router/transactions/trade"
		);
		expect(requestBody(calls)).toMatchObject({
			walletAddress: WALLET,
			slippage: 0.01,
			isSponsoredTx: true,
			customRecipient: "0xrecipient",
		});
		const body = requestBody(calls);
		const serializedRoute = body.completeRoute as {
			coinIn: Record<string, unknown>;
			routes: {
				portion: string;
				paths: { protocolName: string }[];
			}[];
		};
		expect(serializedRoute.coinIn).toEqual({
			type: SUI,
			amount: "9007199254740993n",
			tradeFee: "17n",
		});
		expect(serializedRoute.routes[0].portion).toBe("1000000000000000000n");
		expect(
			serializedRoute.routes[0].paths.map((path) => path.protocolName)
		).toEqual(["Cetus", "DeepBookV3"]);

		expect(tx).toBeInstanceOf(Transaction);
		expect(tx.getData()).toEqual({
			version: 2,
			sender: PADDED_WALLET,
			expiration: null,
			gasData: { budget: null, price: null, owner: null, payment: null },
			inputs: [],
			commands: [],
		});
	});

	it("serializes an existing transaction and preserves the returned coin argument", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const inputTx = new Transaction();
		const coinInId = inputTx.object("0x2");
		const serializedInputTx = inputTx.serialize();
		const calls = installJsonResponse({
			tx: EMPTY_SERIALIZED_TRANSACTION,
			coinOutId: { NestedResult: [2, 1] },
		});

		const result = await router.addTransactionForCompleteTradeRoute({
			tx: inputTx,
			walletAddress: WALLET,
			completeRoute,
			slippage: 0.01,
			coinInId,
		});

		expect(calls[0]?.input).toBe(
			"https://sdk.test/api/router/transactions/add-trade"
		);
		expect(requestBody(calls)).toMatchObject({
			walletAddress: WALLET,
			slippage: 0.01,
			serializedTx: serializedInputTx,
			coinInId: { $kind: "Input", Input: 0, type: "object" },
		});
		expect(requestBody(calls)).not.toHaveProperty("tx");
		expect(inputTx.serialize()).toBe(serializedInputTx);

		expect(result.tx).toBeInstanceOf(Transaction);
		expect(result.tx.serialize()).toBe(EMPTY_SERIALIZED_TRANSACTION);
		expect(result.coinOutId).toEqual({ NestedResult: [2, 1] });
	});

	it("returns an undefined coinOutId when the add-trade response omits it", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const calls = installJsonResponse({ tx: EMPTY_SERIALIZED_TRANSACTION });

		const result = await router.addTransactionForCompleteTradeRoute({
			tx: new Transaction(),
			walletAddress: WALLET,
			completeRoute,
			slippage: 0,
		});

		expect(calls[0]?.init?.method).toBe("POST");
		expect(result.coinOutId).toBeUndefined();
	});

	it("maps indexer events and advances a full page cursor", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const calls = installJsonResponse(eventResponseWire);

		const result = await router.getInteractionEvents({
			walletAddress: WALLET,
			cursor: 5,
			limit: 2,
		});

		expect(calls[0]?.input).toBe("https://sdk.test/api/router/events-by-user");
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			cursor: 5,
			limit: 2,
		});
		expect(result.nextCursor).toBe(7);
		expect(result.events[0]).toEqual({
			type: TRADE_EVENT_TYPE,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-1",
			trader: WALLET,
			coinInType: SUI,
			coinInAmount: 9007199254740993n,
			coinOutType: USDC,
			coinOutAmount: 12345678901234567890n,
		});
		expect(result.events[1]?.timestamp).toBeUndefined();
		expect(result.events[1]?.coinInAmount).toBe(0n);
	});

	it("ends a short page and preserves the numeric cursor edge case for limit zero", async () => {
		const router = new Router({ baseUrl: BASE_URL });
		const shortPage = [eventResponseWire[0]];
		installJsonResponse(shortPage);
		expect(
			(
				await router.getInteractionEvents({
					walletAddress: WALLET,
					cursor: 5,
					limit: 10,
				})
			).nextCursor
		).toBeUndefined();

		installJsonResponse([]);
		expect(
			(
				await router.getInteractionEvents({
					walletAddress: WALLET,
					cursor: 12,
					limit: 0,
				})
			).nextCursor
		).toBe(12);
	});
});

describe("Router transport failures", () => {
	const router = () => new Router({ baseUrl: BASE_URL });

	it("classifies HTTP failures and preserves status and retry metadata", async () => {
		installResponse("busy", {
			status: 429,
			statusText: "Too Many Requests",
			headers: { "Retry-After": "2" },
		});

		const error = await router()
			.getVolume24hrs()
			.catch((value: unknown) => value);
		expect(isAftermathTransportError(error)).toBe(true);
		if (!isAftermathTransportError(error)) {
			return;
		}
		expect(error.kind).toBe("http");
		expect(error.status).toBe(429);
		expect(error.retryAfterMs).toBe(2000);
		expect(error.message).toBe("HTTP 429 Too Many Requests: busy");
	});

	it("classifies malformed successful responses as decode failures", async () => {
		installResponse("{not-json");

		await expect(router().getSupportedCoins()).rejects.toMatchObject({
			kind: "decode",
		});
	});

	it("classifies a rejected boundary fetch as a network failure", async () => {
		installRejectedFetch(new Error("socket offline"));

		await expect(router().getVolume24hrs()).rejects.toMatchObject({
			kind: "network",
			message: "socket offline",
		});
	});

	it("classifies an aborted request and still forwards its signal", async () => {
		const controller = new AbortController();
		controller.abort();
		const calls = installRejectedFetch(new Error("request stopped"));

		await expect(
			router().searchSupportedCoins({ filter: "SUI" }, controller.signal)
		).rejects.toMatchObject({
			kind: "abort",
			abortSource: "caller",
		});
		expect(calls[0]?.init?.signal).toBe(controller.signal);
	});

	it("reports missing API configuration before making a fetch call", async () => {
		await expect(new Router().getVolume24hrs()).rejects.toMatchObject({
			kind: "network",
			message: "no apiBaseUrl: unable to fetch data",
		});
	});
});

describe("RouterApi provider boundary", () => {
	const addresses = { packages: { utils: ROUTER_UTILS_PACKAGE } };

	it("rejects construction when router addresses are missing", () => {
		expect(
			() => new RouterApi({ addresses: {} } as unknown as AftermathApi)
		).toThrow("not all required addresses have been set in provider");
	});

	it("derives event types and exposes the complete router Move error table", () => {
		const routerApi = new RouterApi({
			addresses: { router: addresses },
		} as unknown as AftermathApi);

		expect(RouterApi.constants).toEqual({
			moduleNames: {
				router: "router",
				events: "events",
				protocolFee: "protocol_fee",
				version: "version",
				admin: "admin",
			},
			eventNames: { routerTrade: "SwapCompletedEvent" },
		});
		expect(routerApi.addresses).toBe(addresses);
		expect(routerApi.eventTypes).toEqual({ routerTrade: TRADE_EVENT_TYPE });
		expect(routerApi.moveErrors).toEqual({
			[ROUTER_UTILS_PACKAGE]: {
				protocol_fee: {
					1: "Protocol Fee Config Already Created",
					2: "Bad Epoch",
					3: "Not Normalized",
				},
				router: {
					0: "Not Authorized",
					1: "Invalid Coin In",
					2: "Invalid Coin Out",
					4: "Invalid Previous Swap",
					5: "Invalid Slippage",
					6: "No Fees Paid",
				},
				version: { 0: "Invalid Version" },
				admin: {
					0: "Not Authorized",
					1: "Already Authorized",
				},
			},
		});
	});
});

describe("RouterApiCasting.routerTradeEventFromOnChain", () => {
	const onChainEvent: RouterTradeEventOnChain = {
		id: { txDigest: "digest-1", eventSeq: "0" },
		packageId: ROUTER_UTILS_PACKAGE,
		transactionModule: "events",
		sender: WALLET,
		type: TRADE_EVENT_TYPE,
		parsedJson: {
			swapper: WALLET,
			type_in: SUI,
			amount_in: "9007199254740993",
			type_out: USDC,
			amount_out: "12345678901234567890",
			router_fee: "0",
			router_fee_recipient: FEE_RECIPIENT,
		},
		bcs: "",
		timestampMs: "1700000000123",
	};

	it("casts string bigint amounts and string timestamps without losing precision", () => {
		expect(RouterApiCasting.routerTradeEventFromOnChain(onChainEvent)).toEqual({
			trader: WALLET,
			coinInType: SUI,
			coinInAmount: 9007199254740993n,
			coinOutType: USDC,
			coinOutAmount: 12345678901234567890n,
			timestamp: 1_700_000_000_123,
			txnDigest: "digest-1",
			type: TRADE_EVENT_TYPE,
		});
	});

	it("converts numeric timestamps and exposes invalid bigint input as an error", () => {
		expect(
			RouterApiCasting.routerTradeEventFromOnChain({
				...onChainEvent,
				timestampMs: 1_700_000_000_123,
			}).timestamp
		).toBe(1_700_000_000_123);

		expect(() =>
			RouterApiCasting.routerTradeEventFromOnChain({
				...onChainEvent,
				parsedJson: { ...onChainEvent.parsedJson, amount_in: "not-a-bigint" },
			})
		).toThrow();
	});

	it("returns NaN for an absent on-chain timestamp rather than inventing a value", () => {
		const event = RouterApiCasting.routerTradeEventFromOnChain({
			...onChainEvent,
			timestampMs: undefined,
		});

		expect(event.timestamp).toBeNaN();
	});
});
