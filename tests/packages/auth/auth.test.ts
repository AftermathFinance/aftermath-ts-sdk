import {
	API_BASE_URL,
	Auth,
	describe,
	expect,
	FULL_ONE,
	FULL_TWO,
	installJsonFetch,
	installRejectingFetch,
	it,
	jest,
	OTHER_WALLET,
	requestBody,
	requestUrl,
	WALLET,
} from "@test/packages/auth/fixtures.js";

describe("Auth", () => {
	it("signs and posts deterministic access-token messages, schedules refresh, and cancels it", async () => {
		jest.useFakeTimers();
		jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		jest.spyOn(Math, "random").mockReturnValue(0.25);
		const calls = installJsonFetch({
			accessToken: "access-token",
			header: "Authorization",
			expirationTimestamp: 1_700_001_000_000,
		});
		const messages: string[] = [];
		const signMessageCallback = jest.fn(
			({ message }: { message: Uint8Array }) => {
				messages.push(new TextDecoder().decode(message));
				return Promise.resolve({ signature: "signature-1" });
			}
		);
		const auth = new Auth({ baseUrl: API_BASE_URL });

		const stop = await auth.init({
			walletAddress: WALLET,
			signMessageCallback,
		});
		const serialized = JSON.parse(messages[0] ?? "{}");
		expect(serialized).toEqual({
			date: 1_700_000_000,
			nonce: 262_144,
			method: "GetAccessToken",
			value: {},
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/auth/access-token`
		);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: FULL_ONE,
			signature: "signature-1",
			serializedJson: messages[0],
		});
		expect(auth.config.accessToken).toBe("access-token");
		expect(signMessageCallback).toHaveBeenCalledTimes(1);
		stop();
		await jest.advanceTimersByTimeAsync(2_000_000);
		expect(signMessageCallback).toHaveBeenCalledTimes(1);
	});

	it("serializes admin account creation data and forwards the signed request", async () => {
		const calls = installJsonFetch(true);
		const messages: string[] = [];
		const auth = new Auth({ baseUrl: API_BASE_URL });
		await expect(
			auth.adminCreateAuthAccount({
				walletAddress: WALLET,
				accountWalletAddress: OTHER_WALLET,
				accountName: "sub-account",
				rateLimits: [{ p: "/pools", m: { GET: { l: 10 }, POST: { l: 2 } } }],
				signMessageCallback: ({ message }) => {
					messages.push(new TextDecoder().decode(message));
					return Promise.resolve({ signature: "admin-signature" });
				},
			})
		).resolves.toBe(true);
		const serialized = JSON.parse(messages[0] ?? "{}");
		expect(serialized.method).toBe("AccountCreate");
		expect(serialized.value).toEqual({
			sub: "sub-account",
			wallet_address: FULL_TWO,
			rate_limits: [{ p: "/pools", m: { GET: { l: 10 }, POST: { l: 2 } } }],
		});
		expect(requestUrl(calls[0])).toBe(
			`${API_BASE_URL.slice(0, -1)}/api/auth/create-account`
		);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: FULL_ONE,
			signature: "admin-signature",
			serializedJson: messages[0],
		});
	});

	it("classifies auth HTTP and network failures at the public boundary", async () => {
		installJsonFetch({ error: "denied" }, 401);
		await expect(
			new Auth({ baseUrl: API_BASE_URL }).adminCreateAuthAccount({
				walletAddress: WALLET,
				accountWalletAddress: OTHER_WALLET,
				accountName: "name",
				rateLimits: [],
				signMessageCallback: () => Promise.resolve({ signature: "sig" }),
			})
		).rejects.toEqual(expect.objectContaining({ kind: "http", status: 401 }));

		const calls = installRejectingFetch();
		await expect(
			new Auth({ baseUrl: API_BASE_URL }).adminCreateAuthAccount({
				walletAddress: WALLET,
				accountWalletAddress: OTHER_WALLET,
				accountName: "name",
				rateLimits: [],
				signMessageCallback: () => Promise.resolve({ signature: "sig" }),
			})
		).rejects.toEqual(expect.objectContaining({ kind: "network" }));
		expect(calls).toHaveLength(1);
	});
});
