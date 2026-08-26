import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

import { Transaction } from "@mysten/sui/transactions";

import type { AftermathApi } from "@sdk/general/providers";

import { Dca } from "@sdk/packages/dca/dca";

import {
	type FetchCall,
	installRecordedFetch,
	requestBody,
} from "@test/support/http";

import { transactionCommands } from "@test/support/transactions";

type DcaApiClass = typeof import("@sdk/packages/dca/api/dcaApi").DcaApi;

type ReferralVaultApiClass =
	typeof import("@sdk/packages/referralVault/api/referralVaultApi").ReferralVaultApi;

let DcaApi: DcaApiClass;

let ReferralVaultApi: ReferralVaultApiClass;

beforeAll(async () => {
	jest.unstable_mockModule("@sdk/general/utils/casting", () => ({
		Casting: {
			bigIntFromBytes: (bytes: number[] | Uint8Array) => {
				let value = 0n;
				for (const [index, byte] of bytes.entries()) {
					value += BigInt(byte) * 2n ** BigInt(index * 8);
				}
				return value;
			},
		},
	}));
	({ DcaApi } = await import("@sdk/packages/dca/api/dcaApi"));
	({ ReferralVaultApi } = await import(
		"@sdk/packages/referralVault/api/referralVaultApi"
	));
});

type JsonRecord = Record<string, unknown>;

type FetchResponder = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const BASE_URL = "https://sdk.test";

const WALLET = `0x${"1".repeat(64)}`;

const RECIPIENT = `0x${"2".repeat(64)}`;

const REFERRER = `0x${"3".repeat(64)}`;

const COIN_A = "0x2::sui::SUI";

const COIN_B = `0x${"b".repeat(64)}::coin::B`;

const PACKAGE = `0x${"a".repeat(64)}`;

const EVENTS = `0x${"c".repeat(64)}`;

const EVENTS_V2 = `0x${"d".repeat(64)}`;

const DCA_CONFIG = `0x${"f".repeat(64)}`;

const ORDER_ID = `0x${"4".repeat(64)}`;

const SECOND_ORDER_ID = `0x${"5".repeat(64)}`;

const dcaAddresses = {
	packages: { dca: PACKAGE, events: EVENTS, eventsV2: EVENTS_V2 },
	objects: { config: DCA_CONFIG },
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetch(responder: FetchResponder): FetchCall[] {
	return installRecordedFetch(responder);
}

function installJsonFetch(
	payload: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {}
): FetchCall[] {
	return installFetch(
		() =>
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json", ...extraHeaders },
			})
	);
}

function moveCallData(tx: Transaction): JsonRecord {
	const command = transactionCommands(tx).find(
		(candidate) => candidate.$kind === "MoveCall"
	);
	if (!command || typeof command.MoveCall !== "object") {
		throw new Error("expected a MoveCall command");
	}
	return command.MoveCall as JsonRecord;
}

function fakeApi(
	input: { addresses?: Record<string, unknown>; [key: string]: unknown } = {}
): AftermathApi {
	return {
		client: {},
		addresses: {},
		...input,
	} as unknown as AftermathApi;
}

function serializedTransaction(): string {
	const tx = new Transaction();
	tx.setSender(WALLET);
	tx.moveCall({
		target: `${PACKAGE}::fixture::build`,
		typeArguments: [],
		arguments: [],
	});
	return tx.serialize();
}

const DCA_ORDER_RESPONSE = {
	objectId: ORDER_ID,
	overview: {
		allocatedCoin: { coin: COIN_A, amount: "10000000000000000001n" },
		buyCoin: { coin: COIN_B, amount: "2500000000000000000n" },
		totalSpent: "5000000000000000000n",
		intervalMs: 3_600_000,
		totalTrades: 5,
		tradesRemaining: 4,
		maxSlippageBps: 75,
		strategy: { minPrice: "1n", maxPrice: "2n" },
		recipient: RECIPIENT,
		progress: 0.2,
		created: {
			timestamp: 1_700_000_000_000,
			time: 1_700_000_000_000,
			txnDigest: "created-digest",
			tnxDigest: "created-digest",
		},
		nextTrade: {
			timestamp: 1_700_003_600_000,
			time: 1_700_003_600_000,
			txnDigest: "next-digest",
			tnxDigest: "next-digest",
		},
		integratorFee: { feeBps: 10, feeRecipient: REFERRER },
	},
	trades: [
		{
			allocatedCoin: { coin: COIN_A, amount: "1000000000000000000n" },
			buyCoin: { coin: COIN_B, amount: "500000000000000000n" },
			txnDigest: "trade-digest",
			tnxDigest: "trade-digest",
			txnTimestamp: 1_700_000_100_000,
			tnxDate: 1_700_000_100_000,
			rate: 0.5,
		},
	],
	failed: [{ timestamp: 1_700_000_200_000, reason: "STRATEGY" }],
};

export {
	COIN_A,
	COIN_B,
	DcaApi,
	dcaAddresses,
	describe,
	EVENTS,
	EVENTS_V2,
	expect,
	fakeApi,
	it,
	moveCallData,
	ORDER_ID,
	PACKAGE,
	Transaction,
	BASE_URL,
	DCA_ORDER_RESPONSE,
	Dca,
	installFetch,
	installJsonFetch,
	RECIPIENT,
	REFERRER,
	requestBody,
	SECOND_ORDER_ID,
	serializedTransaction,
	WALLET,
};
