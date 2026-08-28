import {
	authBody,
	BASE_URL,
	COIN_A,
	COIN_B,
	describe,
	expect,
	installFetch,
	installJsonFetch,
	it,
	LIMIT_ORDER_RESPONSE,
	LimitOrders,
	ORDER_ID,
	RECIPIENT,
	REFERRER,
	requestBody,
	SECOND_ORDER_ID,
	transactionKind,
	Transaction,
	WALLET,
} from "@test/packages/limitOrders/fixtures.js";

describe("LimitOrders HTTP facade and signing", () => {
	it("routes active, past, minimum-size, cancel, and preserves response bigint fields", async () => {
		const calls = installFetch((input) => {
			const url = String(input);
			if (url.endsWith("/active")) {
				return Response.json([LIMIT_ORDER_RESPONSE]);
			}
			if (url.endsWith("/past")) {
				return Response.json([]);
			}
			if (url.endsWith("/min-order-size-usd")) {
				return Response.json(0);
			}
			return Response.json(false);
		});
		const client = new LimitOrders({ baseUrl: BASE_URL });
		const signed = authBody();

		await expect(client.getActiveLimitOrders(signed)).resolves.toEqual([
			expect.objectContaining({
				allocatedCoin: {
					coin: COIN_A,
					amount: 9_007_199_254_740_993n,
				},
				status: "StopLossTriggered",
			}),
		]);
		await expect(
			client.getPastLimitOrders({ walletAddress: WALLET })
		).resolves.toEqual([]);
		await expect(client.getMinOrderSizeUsd()).resolves.toBe(0);
		await expect(
			client.cancelLimitOrder({
				...signed,
				orderObjectIds: [ORDER_ID],
			})
		).resolves.toBe(false);

		expect(calls.map(({ input }) => input)).toEqual([
			`${BASE_URL}/api/limit-orders/active`,
			`${BASE_URL}/api/limit-orders/past`,
			`${BASE_URL}/api/limit-orders/min-order-size-usd`,
			`${BASE_URL}/api/limit-orders/cancel`,
		]);
		expect(requestBody(calls, 0)).toEqual(signed);
		expect(requestBody(calls, 1)).toEqual({ walletAddress: WALLET });
		expect(requestBody(calls, 2)).toEqual({});
		expect(requestBody(calls, 3)).toEqual({
			...signed,
			orderObjectIds: [ORDER_ID],
		});
	});

	it("posts create-order boundaries with bigint amounts and restores the sender", async () => {
		const calls = installJsonFetch({ txKind: await transactionKind() });
		const input = {
			walletAddress: WALLET,
			allocateCoinType: COIN_A,
			allocateCoinAmount: 9_007_199_254_740_993n,
			buyCoinType: COIN_B,
			customRecipient: RECIPIENT,
			expiryDurationMs: 0,
			isSponsoredTx: false,
			integratorFee: { feeBps: 0, feeRecipient: REFERRER },
			outputToInputExchangeRate: 0,
			outputToInputStopLossExchangeRate: 0.25,
		};
		const result = await new LimitOrders({
			baseUrl: BASE_URL,
		}).getCreateLimitOrderTx(input);

		expect(result).toBeInstanceOf(Transaction);
		expect(result.getData().sender).toBe(WALLET);
		expect(requestBody(calls)).toEqual({
			...input,
			allocateCoinAmount: "9007199254740993n",
		});
	});

	it("creates the deprecated cancellation signing payload", () => {
		expect(
			new LimitOrders().cancelLimitOrdersMessageToSign({
				orderIds: [ORDER_ID, SECOND_ORDER_ID],
			})
		).toEqual({
			action: "CANCEL_LIMIT_ORDERS",
			order_object_ids: [ORDER_ID, SECOND_ORDER_ID],
		});
	});
});
