import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

import { bcs } from "@mysten/sui/bcs";

import { Transaction } from "@mysten/sui/transactions";

import type { AftermathApi } from "@sdk/general/providers";

import { ReferralVault } from "@sdk/packages/referralVault/referralVault";

import { type FetchCall, installRecordedFetch } from "@test/support/http";

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

const REFERRER = `0x${"3".repeat(64)}`;

const COIN_A = "0x2::sui::SUI";

const COIN_B = `0x${"b".repeat(64)}::coin::B`;

const PACKAGE = `0x${"a".repeat(64)}`;

const REFERRAL_OBJECT = `0x${"e".repeat(64)}`;

const referralVaultAddresses = {
	packages: { referralVault: PACKAGE },
	objects: { referralVault: REFERRAL_OBJECT },
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

function referralApi(
	input: {
		inspections?: {
			fetchFirstBytesFromTxOutput: (input: {
				tx: Transaction;
			}) => Promise<Uint8Array | number[]>;
		};
	} = {}
) {
	return new ReferralVaultApi(
		fakeApi({
			addresses: { referralVault: referralVaultAddresses },
			Inspections: () =>
				input.inspections ?? {
					fetchFirstBytesFromTxOutput: async () => Uint8Array.from([]),
				},
		})
	);
}

export {
	bcs,
	COIN_A,
	COIN_B,
	describe,
	expect,
	fakeApi,
	it,
	jest,
	moveCallData,
	PACKAGE,
	REFERRER,
	ReferralVaultApi,
	referralApi,
	Transaction,
	transactionCommands,
	WALLET,
	BASE_URL,
	installFetch,
	installJsonFetch,
	ReferralVault,
};
