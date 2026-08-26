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

import { Rewards } from "@sdk/packages/rewards/rewards";

import {
	type FetchCall,
	installRecordedFetch,
	requestBody,
} from "@test/support/http";

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

type FetchResponder = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const BASE_URL = "https://sdk.test";

const WALLET = `0x${"1".repeat(64)}`;

const RECIPIENT = `0x${"2".repeat(64)}`;

const COIN_A = "0x2::sui::SUI";

const COIN_B = `0x${"b".repeat(64)}::coin::B`;

const PACKAGE = `0x${"a".repeat(64)}`;

const ORDER_ID = `0x${"4".repeat(64)}`;

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

async function serializedTransactionKind(): Promise<string> {
	const tx = new Transaction();
	tx.moveCall({
		target: `${PACKAGE}::fixture::kind`,
		typeArguments: [],
		arguments: [],
	});
	return Buffer.from(await tx.build({ onlyTransactionKind: true })).toString(
		"base64"
	);
}

function authBody() {
	return {
		walletAddress: WALLET,
		bytes: "dGVybXM=",
		signature: "signature-bytes",
	};
}

export {
	authBody,
	BASE_URL,
	COIN_A,
	COIN_B,
	describe,
	expect,
	fakeApi,
	installFetch,
	installJsonFetch,
	it,
	jest,
	ORDER_ID,
	RECIPIENT,
	Rewards,
	requestBody,
	serializedTransaction,
	serializedTransactionKind,
	Transaction,
	WALLET,
};
