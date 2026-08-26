import {
	BASE_URL,
	describe,
	expect,
	installJsonFetch,
	it,
	requestBody,
	UserData,
	WALLET,
} from "@test/packages/userData/fixtures.js";

describe("UserData API and signing contract", () => {
	it("posts wallet lookup and maps a missing key to undefined", async () => {
		const calls = installJsonFetch(null);
		await expect(
			new UserData({ baseUrl: BASE_URL }).getUserPublicKey({
				walletAddress: WALLET,
			})
		).resolves.toBeUndefined();
		expect(calls[0]?.input).toBe(`${BASE_URL}/api/user-data/public-key`);
		expect(requestBody(calls)).toEqual({ walletAddress: WALLET });
	});

	it("saves a public key with signed bytes and preserves a false response", async () => {
		const calls = installJsonFetch(false);
		const body = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
		};

		await expect(
			new UserData({ baseUrl: BASE_URL }).createUserPublicKey(body)
		).resolves.toBe(false);
		expect(calls[0]?.input).toBe(`${BASE_URL}/api/user-data/save-public-key`);
		expect(requestBody(calls)).toEqual(body);
	});

	it("exposes the exact canonical terms message and legacy account messages", () => {
		const client = new UserData();
		expect(UserData.termsAndConditionsMessage).toBe(
			"Aftermath Terms and Conditions"
		);
		expect(client.createTermsAndConditionsMessage()).toBe(
			"Aftermath Terms and Conditions"
		);
		expect(client.createUserAccountMessageToSign()).toEqual({
			action: "CREATE_USER_ACCOUNT",
		});
		expect(client.createSignTermsAndConditionsMessageToSign()).toEqual({
			action: "SIGN_TERMS_AND_CONDITIONS",
		});
	});
});
