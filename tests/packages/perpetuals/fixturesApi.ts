import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

jest.mock("@sdk/packages/perpetuals/perpetualsAccount", () => ({
	PerpetualsAccount: class {
		public readonly account: unknown;
		public readonly accountCap: unknown;

		public constructor(account: unknown, accountCap: unknown) {
			this.account = account;
			this.accountCap = accountCap;
		}
	},
}));

jest.mock("@sdk/packages/perpetuals/perpetualsMarket", () => ({
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

jest.mock("@sdk/packages/perpetuals/perpetualsVault", () => ({
	PerpetualsVault: class {
		public readonly vaultObject: unknown;

		public constructor(vaultObject: unknown) {
			this.vaultObject = vaultObject;
		}
	},
}));

import type { EventOnChain } from "@sdk/general/types/castingTypes";

import {
	AftermathTransportError,
	isAftermathTransportError,
} from "@sdk/general/utils/transportError";

import type { Perpetuals } from "@sdk/packages/perpetuals/perpetuals";

import {
	PerpetualsOrderSide,
	PerpetualsStopOrderType,
} from "@sdk/packages/perpetuals/perpetualsTypes";

await import("@sdk");

const { PerpetualsApi } = await import(
	"@sdk/packages/perpetuals/api/perpetualsApi"
);

const { PerpetualsApiCasting } = await import(
	"@sdk/packages/perpetuals/api/perpetualsApiCasting"
);

const { Perpetuals: PerpetualsClient } = await import(
	"@sdk/packages/perpetuals/perpetuals"
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

function clientForTest(): Perpetuals {
	return new PerpetualsClient({ baseUrl: API_BASE_URL });
}

export {
	ACCOUNT_ID,
	ACCOUNT_ID_ON_CHAIN,
	ACCOUNT_ID_WIRE,
	API_BASE_URL,
	AftermathTransportError,
	BID_ORDER_ID,
	BID_ORDER_ID_WIRE,
	COLLATERAL,
	EVENT_PACKAGE,
	EVENT_TIMESTAMP,
	EVENT_TYPE,
	FULL_ADDRESS,
	FULL_ID,
	MALFORMED_COLLECTION_REGEX,
	PerpetualsApi,
	PerpetualsApiCasting,
	PerpetualsClient,
	PerpetualsOrderSide,
	PerpetualsStopOrderType,
	SHORT_ADDRESS,
	SHORT_ID,
	TX_DIGEST,
	Transaction,
	afterEach,
	beforeEach,
	clientForTest,
	describe,
	expect,
	expectPost,
	installFetch,
	installFetchHandler,
	isAftermathTransportError,
	it,
	jest,
	onChainEvent,
	originalFetch,
	requestBody,
};
export type { EventOnChain, FetchCall, FetchHandler, Perpetuals };
