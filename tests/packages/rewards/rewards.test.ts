import {
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
} from "@test/packages/rewards/fixtures.js";

describe("Rewards HTTP, bigint mapping, pagination, and claim transactions", () => {
	it("routes read endpoints with signed auth, cursor fields, and boundary values", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			if (url.endsWith("/points")) {
				return Response.json({ totalPoints: 0 });
			}
			if (url.endsWith("/history")) {
				return Response.json({
					history: [
						{
							vaultId: ORDER_ID,
							coinType: COIN_A,
							amount: "18446744073709551615n",
							domain: "referrals",
							epochStartTimestampMs: 1,
							epochEndTimestampMs: 2,
							txDigest: "digest",
							eventType: "deposit",
						},
					],
					pagination: { hasMore: true, nextCursor: 100 },
				});
			}
			return Response.json({
				rewards: [{ coinType: COIN_B, amount: "9007199254740993n" }],
			});
		});
		const client = new Rewards({
			baseUrl: BASE_URL,
			accessToken: "reward-token",
		});
		const signed = authBody();

		await expect(client.getPoints(signed)).resolves.toEqual({
			totalPoints: 0,
		});
		await expect(
			client.getHistory({
				...signed,
				domain: "referrals",
				limit: 100,
				cursor: 99,
			})
		).resolves.toMatchObject({
			history: [
				{
					amount: 18_446_744_073_709_551_615n,
				},
			],
			pagination: { hasMore: true, nextCursor: 100 },
		});
		await expect(
			client.getClaimable({ walletAddress: WALLET })
		).resolves.toEqual({
			rewards: [{ coinType: COIN_B, amount: 9_007_199_254_740_993n }],
		});

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/rewards/points`,
			`${BASE_URL}/api/rewards/history`,
			`${BASE_URL}/api/rewards/claimable`,
		]);
		expect(requestBody(calls, 0)).toEqual(signed);
		expect(requestBody(calls, 1)).toEqual({
			...signed,
			domain: "referrals",
			limit: 100,
			cursor: 99,
		});
		expect(requestBody(calls, 2)).toEqual({ walletAddress: WALLET });
	});

	it("routes the rewards distribution and maps account ids to bigint", async () => {
		const calculationVariables = {
			qScoreCoefficient: 1,
			uptimeCoefficient: 0.5,
			mmVolumeCoefficient: 1,
			takerVolumeCoefficient: 1,
			takerOiCoefficient: 0.25,
		};
		const calls = installJsonFetch({
			totalQScoreFinal: 3,
			totalEstimatedGasCost: 0.01,
			rewards: [{ accountId: "18446744073709551615n", maker: {}, taker: {} }],
		});

		const result = await new Rewards({ baseUrl: BASE_URL }).getDistribution({
			accountIds: [18_446_744_073_709_551_615n],
			totalMakerRewards: 100,
			totalTakerRewards: 50,
			calculationVariables,
		});

		expect(calls.map(({ input }) => String(input))).toEqual([
			`${BASE_URL}/api/rewards/distribution`,
		]);
		// Account ids go out in the API's `"123n"` wire format and come back as bigint.
		expect(requestBody(calls, 0)).toEqual({
			accountIds: ["18446744073709551615n"],
			totalMakerRewards: 100,
			totalTakerRewards: 50,
			calculationVariables,
		});
		expect(result.rewards[0]?.accountId).toBe(18_446_744_073_709_551_615n);
	});

	it("routes the fee rate read and keeps a negative maker rate", async () => {
		const response = {
			epoch: 7,
			makerVolume: 12.5,
			takerVolume: 34.5,
			makerFeeRate: -0.00005,
			takerFeeRate: 0.0004,
			makerVolumeShare: 0.0061,
			takerFeeOverride: false,
		};
		const calls = installJsonFetch(response);

		await expect(
			new Rewards({ baseUrl: BASE_URL }).getFeeRate({ walletAddress: WALLET })
		).resolves.toEqual(response);

		expect(calls.map(({ input }) => String(input))).toEqual([
			`${BASE_URL}/api/rewards/fee-rate`,
		]);
		expect(requestBody(calls, 0)).toEqual({ walletAddress: WALLET });
	});

	it("reads the fee schedule with an empty POST body", async () => {
		const response = {
			epoch: 19,
			epochStartTimestampMs: 1_794_441_600_000,
			epochEndTimestampMs: 1_795_651_200_000,
			takerFeeTiers: [
				{ minVolume: 0, feeRate: 0.00045 },
				{ minVolume: 5_000_000, feeRate: 0.0004 },
			],
			makerFeeTiers: [{ minVolume: 0, feeRate: -0.00005 }],
			makerRebateTiers: [{ minVolumeShare: 0.005, rebateRate: 0.00001 }],
		};
		const calls = installJsonFetch(response);

		await expect(
			new Rewards({ baseUrl: BASE_URL }).getFeeSchedule()
		).resolves.toEqual(response);

		expect(calls.map(({ input }) => String(input))).toEqual([
			`${BASE_URL}/api/rewards/fee-schedule`,
		]);
		expect(calls[0]?.init?.method).toBe("POST");
		expect(requestBody(calls, 0)).toEqual({});
	});

	it("turns a server tx kind into a Transaction and forwards optional coin filters", async () => {
		const txKind = await serializedTransactionKind();
		const fetchBase64TxKindFromTx = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(txKind)
		);
		const transactions = { fetchBase64TxKindFromTx };
		const calls = installJsonFetch({ txKind });
		const client = new Rewards(
			{
				baseUrl: BASE_URL,
			},
			fakeApi({ Transactions: () => transactions })
		);
		const inputTx = new Transaction();

		const result = await client.getClaimTransaction({
			walletAddress: WALLET,
			coinTypes: [COIN_A, COIN_B],
			recipientAddress: RECIPIENT,
			tx: inputTx,
		});

		expect(result.tx).toBeInstanceOf(Transaction);
		expect(fetchBase64TxKindFromTx).toHaveBeenCalledWith({ tx: inputTx });
		expect(requestBody(calls)).toEqual({
			walletAddress: WALLET,
			coinTypes: [COIN_A, COIN_B],
			recipientAddress: RECIPIENT,
			txKind,
		});
	});

	it("uses the sponsored full-transaction response branch and supports a missing API", async () => {
		const txKind = await serializedTransactionKind();
		const fullTransaction = serializedTransaction();
		const fetchBase64TxKindFromTx = jest.fn((_input: { tx: Transaction }) =>
			Promise.resolve(txKind)
		);
		const calls = installJsonFetch({
			txKind: fullTransaction,
			sponsorSignature: "sponsor-signature",
		});
		const sponsoredResult = await new Rewards(
			{ baseUrl: BASE_URL },
			fakeApi({
				Transactions: () => ({ fetchBase64TxKindFromTx }),
			})
		).getClaimTransaction({ walletAddress: WALLET });

		expect(sponsoredResult).toMatchObject({
			sponsorSignature: "sponsor-signature",
			tx: expect.any(Transaction),
		});
		expect(requestBody(calls)).toEqual({ walletAddress: WALLET, txKind });

		const missingApiCalls = installJsonFetch({ txKind });
		await expect(
			new Rewards({ baseUrl: BASE_URL }).getClaimTransaction({
				walletAddress: WALLET,
			})
		).resolves.toMatchObject({ tx: expect.any(Transaction) });
		expect(requestBody(missingApiCalls)).toEqual({ walletAddress: WALLET });
	});

	it("normalizes an HTTP failure as an SDK transport error", async () => {
		installJsonFetch({ error: "rate limited" }, 429, { "Retry-After": "3" });
		await expect(
			new Rewards({ baseUrl: BASE_URL }).getPoints(authBody())
		).rejects.toMatchObject({ kind: "http", status: 429, retryAfterMs: 3000 });
	});
});
