import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

import { Referrals } from "@sdk/packages/referrals/referrals";

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

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetch(responder: FetchResponder): FetchCall[] {
	return installRecordedFetch(responder);
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
	describe,
	expect,
	installFetch,
	it,
	jest,
	RECIPIENT,
	Referrals,
	requestBody,
	WALLET,
};
