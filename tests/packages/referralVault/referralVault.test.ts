import {
	BASE_URL,
	describe,
	expect,
	installFetch,
	installJsonFetch,
	it,
	REFERRER,
	ReferralVault,
	WALLET,
} from "@test/packages/referralVault/fixtures.js";

describe("ReferralVault HTTP facade", () => {
	it("gets a referrer through the service prefix and preserves None", async () => {
		const calls = installFetch(
			(input) =>
				new Response(
					String(input).endsWith("/referrer")
						? JSON.stringify("None")
						: JSON.stringify(REFERRER),
					{ status: 200 }
				)
		);
		const client = new ReferralVault({ baseUrl: BASE_URL });

		await expect(client.getReferrer({ referee: WALLET })).resolves.toBe("None");
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/referral-vault/${WALLET}/referrer`
		);
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.body).toBeUndefined();
	});

	it("returns a concrete referrer address without adding a request body", async () => {
		const calls = installJsonFetch(REFERRER);
		await expect(
			new ReferralVault({ baseUrl: BASE_URL }).getReferrer({ referee: WALLET })
		).resolves.toBe(REFERRER);
		expect(calls[0]?.init?.body).toBeUndefined();
	});
});
