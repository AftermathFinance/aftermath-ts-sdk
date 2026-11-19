import {
	Achievements,
	BASE_URL,
	describe,
	expect,
	installJsonFetch,
	it,
	requestBody,
	WALLET,
} from "@test/packages/achievements/fixtures.js";

describe("Achievements HTTP reads", () => {
	it("GETs definitions with no body and drops null optional thresholds", async () => {
		const calls = installJsonFetch({
			definitions: [
				{
					achievementId: "SPOT_FIRST",
					name: "First spot",
					description: "Swap once",
					product: "spot",
					tier: "common",
					xpReward: 100,
					pointsReward: 10,
					enabled: true,
					imageUrl: "https://example.com/spot.png",
					trigger: "spot_swap",
					thresholdUsd: null,
					thresholdCount: null,
					mintOnUnlock: false,
				},
			],
		});

		await expect(
			new Achievements({ baseUrl: BASE_URL }).getDefinitions()
		).resolves.toEqual({
			definitions: [
				{
					achievementId: "SPOT_FIRST",
					name: "First spot",
					description: "Swap once",
					product: "spot",
					tier: "common",
					xpReward: 100,
					pointsReward: 10,
					enabled: true,
					imageUrl: "https://example.com/spot.png",
					trigger: "spot_swap",
					thresholdUsd: undefined,
					thresholdCount: undefined,
					mintOnUnlock: false,
				},
			],
		});

		expect(calls[0]?.input).toBe(`${BASE_URL}/api/achievements/definitions`);
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.body).toBeUndefined();
	});

	it("POSTs signed wallet auth to me and maps unlock status fields", async () => {
		const calls = installJsonFetch({
			walletAddress: WALLET,
			progress: {
				level: 1,
				xp: 100,
				achievementCount: 1,
				progressObjectId: null,
			},
			unlocks: [
				{
					achievementId: "SPOT_FIRST",
					unlockedAtMs: 1_700_000_000_000,
					pointsStatus: "credited",
					mintStatus: "mint_failed",
					mintDigest: null,
					qualifyStatus: "dry_run",
					qualifyDigest: null,
					xpAwarded: 100,
					pointsAwarded: 10,
					rarityPercent: 25,
				},
			],
		});
		const body = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
		};

		await expect(
			new Achievements({ baseUrl: BASE_URL }).getMe(body)
		).resolves.toEqual({
			walletAddress: WALLET,
			progress: {
				level: 1,
				xp: 100,
				achievementCount: 1,
				progressObjectId: undefined,
			},
			unlocks: [
				{
					achievementId: "SPOT_FIRST",
					unlockedAtMs: 1_700_000_000_000,
					pointsStatus: "credited",
					mintStatus: "mint_failed",
					mintDigest: undefined,
					qualifyStatus: "dry_run",
					qualifyDigest: undefined,
					xpAwarded: 100,
					pointsAwarded: 10,
					rarityPercent: 25,
				},
			],
		});

		expect(calls[0]?.input).toBe(`${BASE_URL}/api/achievements/me`);
		expect(calls[0]?.init?.method).toBe("POST");
		expect(requestBody(calls)).toEqual(body);
	});

	it("rejects getMe when the response walletAddress differs from the request", async () => {
		installJsonFetch({
			walletAddress: `0x${"2".repeat(64)}`,
			unlocks: [],
		});

		await expect(
			new Achievements({ baseUrl: BASE_URL }).getMe({
				walletAddress: WALLET,
				bytes: "dGVybXM=",
				signature: "sig",
			})
		).rejects.toMatchObject({ kind: "decode" });
	});

	it.each([
		{ label: "omitted", payload: { unlocks: [] } },
		{ label: "null", payload: { walletAddress: null, unlocks: [] } },
	])("rejects getMe when the response walletAddress is $label", async ({
		payload,
	}) => {
		installJsonFetch(payload);

		await expect(
			new Achievements({ baseUrl: BASE_URL }).getMe({
				walletAddress: WALLET,
				bytes: "dGVybXM=",
				signature: "sig",
			})
		).rejects.toMatchObject({ kind: "decode" });
	});

	it("normalizes an HTTP failure as an SDK transport error", async () => {
		installJsonFetch({ error: "unauthorized" }, 401);
		await expect(
			new Achievements({ baseUrl: BASE_URL }).getDefinitions()
		).rejects.toMatchObject({ kind: "http", status: 401 });
	});
});

describe("Achievements claim assist", () => {
	it("POSTs the claim body and returns the unsigned intent with echoed progress object", async () => {
		const progressObjectId = `0x${"d".repeat(64)}`;
		const calls = installJsonFetch({
			walletAddress: WALLET,
			achievementId: "SPOT_FIRST",
			intent: {
				function: "claim_achievement",
				packageId: `0x${"a".repeat(64)}`,
				registryId: `0x${"b".repeat(64)}`,
				claimAllowlistId: `0x${"c".repeat(64)}`,
				achievementId: "SPOT_FIRST",
				progressObjectId,
				transferProgress: true,
			},
			notes:
				"User signs and pays gas. Call claim_achievement then mint::transfer_progress to sender.",
		});
		const body = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
			achievementId: "SPOT_FIRST",
			progressObjectId,
		};

		await expect(
			new Achievements({ baseUrl: BASE_URL }).claimAchievement(body)
		).resolves.toEqual({
			walletAddress: WALLET,
			achievementId: "SPOT_FIRST",
			intent: {
				function: "claim_achievement",
				packageId: `0x${"a".repeat(64)}`,
				registryId: `0x${"b".repeat(64)}`,
				claimAllowlistId: `0x${"c".repeat(64)}`,
				achievementId: "SPOT_FIRST",
				progressObjectId,
				transferProgress: true,
			},
			notes:
				"User signs and pays gas. Call claim_achievement then mint::transfer_progress to sender.",
		});

		expect(calls[0]?.input).toBe(`${BASE_URL}/api/achievements/claim`);
		expect(calls[0]?.init?.method).toBe("POST");
		expect(requestBody(calls)).toEqual(body);
	});

	it("POSTs a first claim with no progress object and accepts a null intent id", async () => {
		const calls = installJsonFetch({
			walletAddress: WALLET,
			achievementId: "SPOT_FIRST",
			intent: {
				function: "claim_achievement",
				packageId: `0x${"a".repeat(64)}`,
				registryId: `0x${"b".repeat(64)}`,
				claimAllowlistId: `0x${"c".repeat(64)}`,
				achievementId: "SPOT_FIRST",
				progressObjectId: null,
				transferProgress: true,
			},
			notes: "User signs and pays gas.",
		});
		const body = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
			achievementId: "SPOT_FIRST",
		};

		await expect(
			new Achievements({ baseUrl: BASE_URL }).claimAchievement(body)
		).resolves.toEqual({
			walletAddress: WALLET,
			achievementId: "SPOT_FIRST",
			intent: {
				function: "claim_achievement",
				packageId: `0x${"a".repeat(64)}`,
				registryId: `0x${"b".repeat(64)}`,
				claimAllowlistId: `0x${"c".repeat(64)}`,
				achievementId: "SPOT_FIRST",
				progressObjectId: undefined,
				transferProgress: true,
			},
			notes: "User signs and pays gas.",
		});

		expect(requestBody(calls)).toEqual(body);
	});

	const claimBody = {
		walletAddress: WALLET,
		bytes: "dGVybXM=",
		signature: "sig",
		achievementId: "SPOT_FIRST",
		progressObjectId: `0x${"d".repeat(64)}`,
	};

	function claimPayload(
		intentOverrides: Record<string, unknown> = {},
		responseOverrides: Record<string, unknown> = {}
	) {
		return {
			walletAddress: WALLET,
			achievementId: "SPOT_FIRST",
			intent: {
				function: "claim_achievement",
				packageId: `0x${"a".repeat(64)}`,
				registryId: `0x${"b".repeat(64)}`,
				claimAllowlistId: `0x${"c".repeat(64)}`,
				achievementId: "SPOT_FIRST",
				progressObjectId: claimBody.progressObjectId,
				transferProgress: true,
				...intentOverrides,
			},
			notes: "User signs and pays gas.",
			...responseOverrides,
		};
	}

	it.each([
		{
			label: "wallet",
			payload: claimPayload({}, { walletAddress: `0x${"2".repeat(64)}` }),
			message: "Claim response wallet does not match the signed wallet",
		},
		{
			label: "response achievement",
			payload: claimPayload({}, { achievementId: "OTHER" }),
			message: "Claim response achievement does not match the request",
		},
		{
			label: "intent achievement",
			payload: claimPayload({ achievementId: "OTHER" }),
			message: "Claim intent achievement does not match the request",
		},
		{
			label: "function",
			payload: claimPayload({ function: "mint_achievement" }),
			message: "Claim intent function is not claim_achievement",
		},
		{
			label: "package id",
			payload: claimPayload({ packageId: "not-an-id" }),
			message: "Claim intent package id is invalid",
		},
		{
			label: "registry id",
			payload: claimPayload({ registryId: "" }),
			message: "Claim intent registry id is invalid",
		},
		{
			label: "allowlist id",
			payload: claimPayload({ claimAllowlistId: "0x" }),
			message: "Claim intent allowlist id is invalid",
		},
		{
			label: "progress object id",
			payload: claimPayload({ progressObjectId: "not-an-id" }),
			message: "Claim intent progress object id is invalid",
		},
		{
			label: "progress object id mismatch",
			payload: claimPayload({
				progressObjectId: `0x${"9".repeat(64)}`,
			}),
			message: "Claim intent progress object id does not match the request",
		},
		{
			label: "dropped progress object id",
			payload: claimPayload({ progressObjectId: null }),
			message: "Claim intent omitted the requested progress object id",
		},
	])("rejects claimAchievement when the $label does not match", async ({
		payload,
		message,
	}) => {
		installJsonFetch(payload);

		await expect(
			new Achievements({ baseUrl: BASE_URL }).claimAchievement(claimBody)
		).rejects.toMatchObject({ kind: "decode", message });
	});
});
