import {
	BASE_URL,
	installJsonFetch,
	MARKET_ID,
	makeMarket,
	makeMarketData,
	type PerpetualsOrderData,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	requestBody,
	USDC,
} from "@test/packages/perpetuals/fixturesDomain.js";

describe("PerpetualsMarket", () => {
	it("exposes market metadata, margin ratios, and safe funding timestamps", () => {
		const market = makeMarket();

		expect(market.marketId).toBe(MARKET_ID);
		expect(market.collateralCoinType).toBe(USDC);
		expect(market.lotSize()).toBe(0.01);
		expect(market.tickSize()).toBe(0.5);
		expect(market.maxLeverage()).toBe(20);
		expect(market.initialMarginRatio()).toBe(0.05);
		expect(market.maintenanceMarginRatio()).toBe(0.025);
		expect(market.estimatedFundingRate()).toBe(0.014);
		expect(market.nextFundingTimeMs()).toBe(1_800_000_000_000);

		Date.now = () => 1_799_999_999_000;
		expect(market.timeUntilNextFundingMs()).toBe(1000);

		const capped = makeMarket({ baseUrl: BASE_URL }, undefined);
		capped.marketData = makeMarketData({
			nextFundingTimestampMs: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
		});
		expect(capped.nextFundingTimeMs()).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("calculates remaining-order collateral and handles falsy leverage", () => {
		const market = makeMarket();
		const orderData: PerpetualsOrderData = {
			marketId: MARKET_ID,
			orderId: 1n,
			side: PerpetualsOrderSide.Bid,
			initialSize: 5_000_000_000n,
			currentSize: 3_000_000_000n,
		};

		expect(
			market.calcCollateralUsedForOrder({
				leverage: 4,
				orderData,
				indexPrice: 2000,
				collateralPrice: 2,
			})
		).toEqual({ collateralUsd: 1500, collateral: 750 });
		expect(
			market.calcCollateralUsedForOrder({
				leverage: 0,
				orderData,
				indexPrice: 2000,
				collateralPrice: 2,
			})
		).toEqual({ collateralUsd: 6000, collateral: 3000 });
	});

	it("rounds prices and sizes with floor, ceil, nearest, and bigint outputs", () => {
		const market = makeMarket();

		expect(market.roundToValidPrice({ price: 101.26, floor: true })).toBe(101);
		expect(market.roundToValidPrice({ price: 101.26, ceil: true })).toBe(101.5);
		expect(market.roundToValidPrice({ price: 101.26 })).toBe(101.5);
		expect(market.roundToValidPriceBigInt({ price: 101.26, floor: true })).toBe(
			101_000_000_000n
		);
		expect(market.roundToValidPriceBigInt({ price: 101.26, ceil: true })).toBe(
			101_500_000_000n
		);

		expect(market.roundToValidSize({ size: 1.236, floor: true })).toBe(1.23);
		expect(market.roundToValidSize({ size: 1.236, ceil: true })).toBe(1.24);
		expect(market.roundToValidSize({ size: 1.236 })).toBe(1.24);
		expect(market.roundToValidSizeBigInt({ size: 1.236, floor: true })).toBe(
			1_230_000_000n
		);
		expect(market.roundToValidSizeBigInt({ size: 1.236, ceil: true })).toBe(
			1_240_000_000n
		);
	});

	it("creates a zeroed position carrying current funding rates", () => {
		const market = makeMarket();
		expect(market.emptyPosition()).toEqual({
			marketId: MARKET_ID,
			collateral: 0,
			collateralUsd: 0,
			baseAssetAmount: 0,
			quoteAssetNotionalAmount: 0,
			cumFundingRateLong: 0.012,
			cumFundingRateShort: -0.008,
			asksQuantity: 0,
			bidsQuantity: 0,
			pendingOrders: [],
			leverage: 1,
			entryPrice: 0,
			freeCollateral: 0,
			freeMarginUsd: 0,
			liquidationPrice: 0,
			marginRatio: 1,
			unrealizedFundingsUsd: 0,
			unrealizedPnlUsd: 0,
		});
	});

	it("fetches orderbook and preserves bigint max-order-size responses", async () => {
		const market = makeMarket();
		const orderbook = {
			bids: [{ price: 1999, quantity: 3 }],
			asks: [{ price: 2001, quantity: 4 }],
		};
		let calls = installJsonFetch({ orderbooks: [{ orderbook }] });
		await expect(market.getOrderbook()).resolves.toEqual({ orderbook });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/markets/orderbooks`
		);
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({ maxOrderSize: "9007199254740993n" });
		await expect(
			market.getMaxOrderSize({
				accountId: 9_007_199_254_740_993n,
				side: PerpetualsOrderSide.Bid,
				leverage: 5,
			})
		).resolves.toEqual({ maxOrderSize: 9_007_199_254_740_993n });
		expect(requestBody(calls)).toEqual({
			accountId: "9007199254740993n",
			side: 0,
			leverage: 5,
			marketId: MARKET_ID,
		});
	});

	it("routes market previews and propagates abort signals and error branches", async () => {
		const market = makeMarket();
		const signal = new AbortController().signal;
		const preview = {
			marketId: MARKET_ID,
			side: PerpetualsOrderSide.Bid,
			size: 2_000_000_000n,
			reduceOnly: false,
			leverage: 4,
		};

		let calls = installJsonFetch({ error: "insufficient margin" });
		await expect(
			market.getPlaceMarketOrderPreview(preview as never, signal)
		).resolves.toEqual({ error: "insufficient margin" });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-market-order`
		);
		expect(calls[0]?.init?.signal).toBe(signal);
		expect(requestBody(calls)).toEqual({
			marketId: MARKET_ID,
			side: 0,
			size: "2000000000n",
			reduceOnly: false,
			leverage: 4,
		});

		calls = installJsonFetch({ updatedPosition: { marketId: MARKET_ID } });
		await expect(
			market.getPlaceLimitOrderPreview(preview as never)
		).resolves.toEqual({ updatedPosition: { marketId: MARKET_ID } });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-limit-order`
		);

		calls = installJsonFetch({ updatedPosition: { marketId: MARKET_ID } });
		await expect(
			market.getPlaceScaleOrderPreview({
				...preview,
				totalSize: 4_000_000_000n,
				startPrice: 1_900_000_000_000n,
				endPrice: 2_100_000_000_000n,
				numberOfOrders: 3,
				orderType: PerpetualsOrderType.Standard,
			} as never)
		).resolves.toEqual({ updatedPosition: { marketId: MARKET_ID } });
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/account/previews/place-scale-order`
		);
	});

	it("fetches market stats, prices, and paginated order history through the root client", async () => {
		const market = makeMarket();
		let calls = installJsonFetch({
			marketsStats: [
				{
					volumeUsd: 10_000,
					volumeBaseAssetAmount: 5,
					priceChange: 10,
					priceChangePercentage: 0.01,
					basePrice: 2000,
					collateralPrice: 2,
					midPrice: 2001,
					markPrice: 2002,
				},
			],
		});
		await expect(market.get24hrStats()).resolves.toMatchObject({
			volumeUsd: 10_000,
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/markets/24hr-stats`
		);
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({
			marketsPrices: [
				{
					marketId: MARKET_ID,
					basePrice: 2000,
					collateralPrice: 2,
					midPrice: undefined,
					markPrice: 2002,
				},
			],
		});
		await expect(market.getPrices()).resolves.toEqual({
			marketId: MARKET_ID,
			basePrice: 2000,
			collateralPrice: 2,
			midPrice: undefined,
			markPrice: 2002,
		});
		expect(requestBody(calls)).toEqual({ marketIds: [MARKET_ID] });

		calls = installJsonFetch({
			orders: [{ orderId: "1n" }],
			nextBeforeTimestampCursor: 1_699_999_999_000,
		});
		await expect(
			market.getOrderHistory({
				beforeTimestampCursor: 1_700_000_000_000,
				limit: 25,
			})
		).resolves.toEqual({
			orders: [{ orderId: 1n }],
			nextBeforeTimestampCursor: 1_699_999_999_000,
		});
		expect(calls[0]?.input).toBe(
			`${BASE_URL}/api/perpetuals/market/order-history`
		);
		expect(requestBody(calls)).toEqual({
			beforeTimestampCursor: 1_700_000_000_000,
			limit: 25,
			marketId: MARKET_ID,
		});
	});
});
