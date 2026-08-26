import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { Transaction } from "@mysten/sui/transactions";

import type { ConfigAddresses } from "@sdk/general/types/configTypes";

const { GasPools } = await import("@sdk");

type AftermathApiType =
	import("@sdk/general/providers/aftermathApi").AftermathApi;

type JsonRecord = Record<string, unknown>;

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const API_BASE_URL = "https://sdk.test/";

const WALLET = "0x1";

const OTHER_WALLET = "0x2";

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

function installRejectingFetch(
	error = new Error("offline sentinel")
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.reject(error);
	}) as typeof fetch;
	return calls;
}

function requestBody(call: FetchCall): JsonRecord {
	if (typeof call.init?.body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(call.init.body) as JsonRecord;
}

function requestUrl(call: FetchCall): string {
	return String(call.input);
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

function asyncMock<T = unknown>() {
	return jest.fn<(...args: unknown[]) => Promise<T>>();
}

export {
	API_BASE_URL,
	asyncMock,
	describe,
	expect,
	fakeApi,
	GasPools,
	installJsonFetch,
	installRejectingFetch,
	it,
	jest,
	OTHER_WALLET,
	requestBody,
	requestUrl,
	Transaction,
	WALLET,
	wireJson,
};

export type { FetchCall };
