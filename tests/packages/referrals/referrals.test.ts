import {
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
} from "@test/packages/referrals/fixtures.js";

describe("Referrals HTTP, auth, pagination, and signing", () => {
	it("routes every public endpoint and forwards signed auth plus pagination", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			if (url.endsWith("/ref-code")) {
				return Response.json({ address: WALLET, refCode: null });
			}
			if (url.endsWith("/linked-ref-code")) {
				return Response.json({
					address: WALLET,
					linkedRefCode: null,
					linkedAt: null,
				});
			}
			if (url.endsWith("/query")) {
				return Response.json({
					refCode: "alpha",
					referees: [{ walletAddress: RECIPIENT, joinedAt: 1_700_000_000_000 }],
					totalCount: 257,
				});
			}
			if (url.endsWith("/availability")) {
				return Response.json({ refCode: "fresh", isAvailable: true });
			}
			if (url.endsWith("/create")) {
				return Response.json({
					refCode: "fresh",
					walletAddress: WALLET,
					createdAt: 1_700_000_000_000,
					status: "created",
				});
			}
			return Response.json({
				refereeAddress: WALLET,
				refCode: "alpha",
				createdAt: 1_700_000_000_001,
				status: "linked",
			});
		});
		const client = new Referrals({ baseUrl: BASE_URL, accessToken: "token" });
		const signed = authBody();

		await expect(client.getRefCode(signed)).resolves.toEqual({
			address: WALLET,
			refCode: undefined,
		});
		await expect(client.getLinkedRefCode(signed)).resolves.toEqual({
			address: WALLET,
			linkedRefCode: undefined,
			linkedAt: undefined,
		});
		await expect(
			client.getReferees({ refCode: "alpha", limit: 2, offset: 255 })
		).resolves.toEqual({
			refCode: "alpha",
			referees: [{ walletAddress: RECIPIENT, joinedAt: 1_700_000_000_000 }],
			totalCount: 257,
		});
		await expect(client.isRefCodeTaken({ refCode: "fresh" })).resolves.toEqual({
			refCode: "fresh",
			isAvailable: true,
		});
		await expect(
			client.createReferralLink({ ...signed, refCode: "fresh" })
		).resolves.toMatchObject({ refCode: "fresh", status: "created" });
		await expect(
			client.setReferrer({ ...signed, refCode: "alpha" })
		).resolves.toMatchObject({ refereeAddress: WALLET, status: "linked" });

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/referrals/ref-code`,
			`${BASE_URL}/api/referrals/linked-ref-code`,
			`${BASE_URL}/api/referrals/query`,
			`${BASE_URL}/api/referrals/availability`,
			`${BASE_URL}/api/referrals/create`,
			`${BASE_URL}/api/referrals/link`,
		]);
		expect(requestBody(calls, 0)).toEqual(signed);
		expect(requestBody(calls, 1)).toEqual(signed);
		expect(requestBody(calls, 2)).toEqual({
			refCode: "alpha",
			limit: 2,
			offset: 255,
		});
		expect(requestBody(calls, 3)).toEqual({ refCode: "fresh" });
		expect(requestBody(calls, 4)).toEqual({ ...signed, refCode: "fresh" });
		expect(requestBody(calls, 5)).toEqual({ ...signed, refCode: "alpha" });
		for (const call of calls) {
			expect(call.init?.method).toBe("POST");
			expect(call.init?.headers).toMatchObject({
				Authorization: "Bearer token",
			});
		}
	});

	it("maps present referral code and linked timestamp values", async () => {
		const calls = installFetch((input) => {
			if (String(input).endsWith("/ref-code")) {
				return Response.json({ address: WALLET, refCode: "alpha" });
			}
			return Response.json({
				address: WALLET,
				linkedRefCode: "alpha",
				linkedAt: 1_700_000_000_000,
			});
		});
		const client = new Referrals({ baseUrl: BASE_URL });

		await expect(client.getRefCode(authBody())).resolves.toEqual({
			address: WALLET,
			refCode: "alpha",
		});
		await expect(client.getLinkedRefCode(authBody())).resolves.toEqual({
			address: WALLET,
			linkedRefCode: "alpha",
			linkedAt: 1_700_000_000_000,
		});
		expect(calls).toHaveLength(2);
	});

	it("creates the deprecated action messages with second precision", () => {
		jest.spyOn(Date, "now").mockReturnValue(1_700_000_123_456);
		const client = new Referrals();

		expect(
			client.createReferralLinkMessageToSign({ refCode: "alpha" })
		).toEqual({
			action: "CREATE_REFERRAL",
			ref_code: "alpha",
			date: 1_700_000_123,
		});
		expect(client.setReferrerMessageToSign({ refCode: "alpha" })).toEqual({
			action: "LINK_REFERRAL",
			ref_code: "alpha",
			date: 1_700_000_123,
		});
	});
});
