import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { bcs } from "@mysten/sui/bcs";

import { Transaction } from "@mysten/sui/transactions";

import type { ConfigAddresses } from "@sdk/general/types/configTypes";

const { Faucet } = await import("@sdk");

const { FaucetApi } = await import("@sdk/packages/faucet/api/faucetApi");

const { FaucetApiCasting } = await import(
	"@sdk/packages/faucet/api/faucetApiCasting"
);

type AftermathApiType =
	import("@sdk/general/providers/aftermathApi").AftermathApi;

type JsonRecord = Record<string, unknown>;

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const API_BASE_URL = "https://sdk.test/";

const WALLET = "0x1";

const PAYMENT_COIN = "0x20";

const SUI_TYPE = "0x2::sui::SUI";

const SUI_FREN_TYPE = "0x9::suifrens::SuiFren<0x2::sui::SUI>";

const FULL_ONE = `0x${"1".padStart(64, "0")}`;

const FULL_TWO = `0x${"2".padStart(64, "0")}`;

const FULL_SUI = `${FULL_TWO}::sui::SUI`;

const ADDRESSES = {
	suiFrens: {
		packages: {
			suiFrens: "0x9",
			suiFrensBullshark: "0x8",
			accessories: "0x10",
			suiFrensVault: "0x11",
			suiFrensVaultCapyLabsExtension: "0x12",
		},
		objects: {
			capyLabsApp: "0x21",
			suiFrensVault: "0x22",
			suiFrensVaultStateV1: "0x23",
			suiFrensVaultStateV1MetadataTable: "0x24",
			suiFrensVaultCapyLabsExtension: "0x25",
		},
	},
	faucet: {
		packages: {
			faucet: "0x31",
			suiFrensGenesisWrapper: "0x32",
		},
		objects: {
			faucet: "0x33",
			config: "0x34",
			suiFrensMint: "0x35",
		},
	},
} as const;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
	jest.useRealTimers();
});

function wireJson(value: unknown): string {
	return JSON.stringify(value, (_key, currentValue) =>
		typeof currentValue === "bigint" ? `${currentValue}n` : currentValue
	);
}

function installJsonFetch(
	payload: unknown,
	status = 200,
	headers: Record<string, string> = {}
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(
			new Response(wireJson(payload), {
				status,
				headers: { "Content-Type": "application/json", ...headers },
			})
		);
	}) as typeof fetch;
	return calls;
}

function requestUrl(call: FetchCall): string {
	return String(call.input);
}

function makeEvent(parsedJson: JsonRecord, type = "0x11::events::Event") {
	return {
		id: { txDigest: "digest-event", eventSeq: "0" },
		packageId: "0x11",
		transactionModule: "events",
		sender: WALLET,
		type,
		parsedJson,
		bcs: "",
		timestampMs: "1700000000123",
	};
}

function fakeApi(
	overrides: Record<string, unknown> = {},
	addresses: ConfigAddresses = ADDRESSES
): AftermathApiType {
	return {
		addresses,
		...overrides,
	} as unknown as AftermathApiType;
}

function moveCalls(tx: Transaction): JsonRecord[] {
	return (tx.getData().commands as JsonRecord[]).flatMap((command) =>
		command.$kind === "MoveCall" && typeof command.MoveCall === "object"
			? [command.MoveCall as JsonRecord]
			: []
	);
}

function commands(tx: Transaction): JsonRecord[] {
	return tx.getData().commands as JsonRecord[];
}

function moveCall(tx: Transaction): JsonRecord {
	const call = moveCalls(tx)[0];
	if (!call) {
		throw new Error("expected a MoveCall");
	}
	return call;
}

function asyncMock<T = unknown>() {
	return jest.fn<(...args: unknown[]) => Promise<T>>();
}

export {
	API_BASE_URL,
	asyncMock,
	commands,
	describe,
	expect,
	Faucet,
	FaucetApi,
	FaucetApiCasting,
	FULL_ONE,
	FULL_SUI,
	fakeApi,
	installJsonFetch,
	it,
	jest,
	makeEvent,
	moveCall,
	PAYMENT_COIN,
	requestUrl,
	SUI_FREN_TYPE,
	SUI_TYPE,
	Transaction,
	WALLET,
};
