import {
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
} from "@test/packages/multisig/fixtures.js";

describe("Multisig API and facade", () => {
	it("requires shared-custody addresses", () => {
		expect(() => new MultisigApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
	});

	it("derives a deterministic 1-of-2 multisig from 32-byte and flagged keys", () => {
		const api = new MultisigApi(
			fakeApi({
				addresses: {
					sharedCustody: {
						address: RECIPIENT,
						publicKey: SHARED_CUSTODY_PUBLIC_KEY,
					},
				},
			})
		);

		const result = api.getMultisigForUser({ userPublicKey: USER_PUBLIC_KEY });
		const flaggedUserKey = Uint8Array.from([0, ...USER_PUBLIC_KEY]);
		const flaggedResult = api.getMultisigForUser({
			userPublicKey: flaggedUserKey,
		});

		expect(result.address).toBe(EXPECTED_MULTISIG_ADDRESS);
		expect(result.publicKey.toRawBytes()).toEqual(EXPECTED_MULTISIG_RAW_BYTES);
		expect(flaggedResult.address).toBe(EXPECTED_MULTISIG_ADDRESS);
		expect(flaggedResult.publicKey.toRawBytes()).toEqual(
			EXPECTED_MULTISIG_RAW_BYTES
		);
	});

	it("rejects malformed user public keys", () => {
		const api = new MultisigApi(
			fakeApi({
				addresses: {
					sharedCustody: {
						address: RECIPIENT,
						publicKey: SHARED_CUSTODY_PUBLIC_KEY,
					},
				},
			})
		);
		expect(() =>
			api.getMultisigForUser({ userPublicKey: new Uint8Array(31) })
		).toThrow();
	});

	it("rejects a shared-custody record without a public key", () => {
		const api = new MultisigApi(
			fakeApi({
				addresses: {
					sharedCustody: { address: RECIPIENT, publicKey: "" },
				},
			})
		);
		expect(() =>
			api.getMultisigForUser({ userPublicKey: USER_PUBLIC_KEY })
		).toThrow();
	});

	it("delegates through the public facade and reports a missing provider", () => {
		const getMultisigForUser = jest.fn().mockReturnValue({
			address: EXPECTED_MULTISIG_ADDRESS,
			publicKey: "public-key",
		});
		const api = fakeApi({
			Multisig: () => ({ getMultisigForUser }),
		});
		const client = new Multisig({}, api);
		const input = { userPublicKey: USER_PUBLIC_KEY };

		expect(client.getMultisigForUser(input)).toEqual({
			address: EXPECTED_MULTISIG_ADDRESS,
			publicKey: "public-key",
		});
		expect(getMultisigForUser).toHaveBeenCalledWith(input);
		expect(() => new Multisig().getMultisigForUser(input)).toThrow(
			"missing AftermathApi instance"
		);
	});

	it("uses fixed Ed25519 inputs rather than random key material", () => {
		const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
		expect(keypair.getPublicKey().toRawBytes()).toEqual(USER_PUBLIC_KEY);
	});
});
