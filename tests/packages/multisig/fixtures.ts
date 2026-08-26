import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import type { AftermathApi } from "@sdk/general/providers";

import { MultisigApi } from "@sdk/packages/multisig/api/multisigApi";

import { Multisig } from "@sdk/packages/multisig/multisig";

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

const RECIPIENT = `0x${"2".repeat(64)}`;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function fakeApi(
	input: { addresses?: Record<string, unknown>; [key: string]: unknown } = {}
): AftermathApi {
	return {
		client: {},
		addresses: {},
		...input,
	} as unknown as AftermathApi;
}

const SHARED_CUSTODY_PUBLIC_KEY =
	"AP0XJDhaoMdbZPt4zWAvodmR/ev3axPFjtcC6sg16fYY";

const USER_PUBLIC_KEY = Uint8Array.from([
	234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249, 149,
	71, 118, 174, 190, 190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44,
]);

const EXPECTED_MULTISIG_ADDRESS =
	"0xc59d4d9d6424ba44eadeb88120e2ef0fa163d1464df643c0e485a2afee37bd6c";

const EXPECTED_MULTISIG_RAW_BYTES = Uint8Array.from([
	2, 0, 253, 23, 36, 56, 90, 160, 199, 91, 100, 251, 120, 205, 96, 47, 161, 217,
	145, 253, 235, 247, 107, 19, 197, 142, 215, 2, 234, 200, 53, 233, 246, 24, 1,
	0, 234, 74, 108, 99, 226, 156, 82, 10, 190, 245, 80, 123, 19, 46, 197, 249,
	149, 71, 118, 174, 190, 190, 123, 146, 66, 30, 234, 105, 20, 70, 210, 44, 1,
	1, 0,
]);

export {
	describe,
	Ed25519Keypair,
	EXPECTED_MULTISIG_ADDRESS,
	EXPECTED_MULTISIG_RAW_BYTES,
	expect,
	fakeApi,
	it,
	jest,
	Multisig,
	MultisigApi,
	RECIPIENT,
	SHARED_CUSTODY_PUBLIC_KEY,
	USER_PUBLIC_KEY,
};
