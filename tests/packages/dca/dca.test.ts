import {
	BASE_URL,
	COIN_A,
	COIN_B,
	DCA_ORDER_RESPONSE,
	Dca,
	describe,
	expect,
	installFetch,
	installJsonFetch,
	it,
	ORDER_ID,
	RECIPIENT,
	REFERRER,
	requestBody,
	SECOND_ORDER_ID,
	serializedTransaction,
	Transaction,
	WALLET,
} from "@test/packages/dca/fixtures.js";

describe("DCA HTTP facade and transaction inputs", () => {
	it("fetches all, active, and past orders while preserving bigint response data", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			let payload: unknown = [];
			if (url.endsWith("/orders")) {
				payload = { active: [DCA_ORDER_RESPONSE], past: [] };
			} else if (url.endsWith("/active")) {
				payload = [DCA_ORDER_RESPONSE];
			}
			return Response.json(payload);
		});
		const client = new Dca({ baseUrl: BASE_URL });

		await expect(
			client.getAllDcaOrders({ walletAddress: WALLET })
		).resolves.toEqual({
			active: [
				expect.objectContaining({
					overview: expect.objectContaining({
						allocatedCoin: {
							coin: COIN_A,
							amount: 10_000_000_000_000_000_001n,
						},
					}),
				}),
			],
			past: [],
		});
		await expect(
			client.getActiveDcaOrders({ walletAddress: WALLET })
		).resolves.toHaveLength(1);
		await expect(
			client.getPastDcaOrders({ walletAddress: WALLET })
		).resolves.toEqual([]);

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/dca/orders`,
			`${BASE_URL}/api/dca/active`,
			`${BASE_URL}/api/dca/past`,
		]);
		for (const call of calls) {
			expect(requestBody([call])).toEqual({ walletAddress: WALLET });
		}
	});

	it("posts bigint-safe create-order options and restores a Transaction", async () => {
		const calls = installJsonFetch(serializedTransaction());
		const input = {
			walletAddress: WALLET,
			allocateCoinType: COIN_A,
			allocateCoinAmount: 10_000_000_000_000_000_001n,
			buyCoinType: COIN_B,
			frequencyMs: 0,
			tradesAmount: 1,
			strategy: { minPrice: 1n, maxPrice: 2n },
			isSponsoredTx: false,
			delayTimeMs: 0,
			maxAllowableSlippageBps: 0,
			coinPerTradeAmount: 5n,
			customRecipient: RECIPIENT,
			integratorFee: { feeBps: 10, feeRecipient: REFERRER },
		};

		const result = await new Dca({ baseUrl: BASE_URL }).getCreateDcaOrderTx(
			input
		);
		expect(result).toBeInstanceOf(Transaction);
		expect(result.getData().sender).toBe(WALLET);
		expect(requestBody(calls)).toEqual({
			...input,
			allocateCoinAmount: "10000000000000000001n",
			strategy: { minPrice: "1n", maxPrice: "2n" },
			coinPerTradeAmount: "5n",
		});
	});

	it("forwards signed cancellation data and preserves false responses", async () => {
		const calls = installJsonFetch(false);
		const input = {
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
			orderObjectIds: [ORDER_ID, SECOND_ORDER_ID],
		};

		await expect(
			new Dca({ baseUrl: BASE_URL }).closeDcaOrder(input)
		).resolves.toBe(false);
		expect(calls[0]?.input).toBe(`${BASE_URL}/api/dca/cancel`);
		expect(requestBody(calls)).toEqual(input);
	});

	it("builds cancellation signing data and retains deprecated user endpoints", async () => {
		const client = new Dca({ baseUrl: BASE_URL });
		expect(
			client.closeDcaOrdersMessageToSign({ orderIds: [ORDER_ID] })
		).toEqual({
			action: "CANCEL_DCA_ORDERS",
			order_object_ids: [ORDER_ID],
		});
		expect(client.createUserAccountMessageToSign()).toEqual({
			action: "CREATE_DCA_ACCOUNT",
		});

		const calls = installFetch(
			(input) =>
				new Response(String(input).endsWith("/user/get") ? "null" : "true")
		);
		await expect(
			client.getUserPublicKey({ walletAddress: WALLET })
		).resolves.toBe(undefined);
		await expect(
			client.createUserPublicKey({
				walletAddress: WALLET,
				bytes: "dGVybXM=",
				signature: "sig",
			})
		).resolves.toBe(true);
		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/dca/user/get`,
			`${BASE_URL}/api/dca//user/add`,
		]);
		expect(requestBody(calls, 0)).toEqual({ walletAddress: WALLET });
		expect(requestBody(calls, 1)).toEqual({
			walletAddress: WALLET,
			bytes: "dGVybXM=",
			signature: "sig",
		});
	});
});
