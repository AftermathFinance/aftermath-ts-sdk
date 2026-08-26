import {
	PADDED_EVENT_MARKET_ID,
	PerpetualsApiCasting,
	PerpetualsOrderSide,
} from "@test/packages/perpetuals/fixturesDomain.js";

describe("PerpetualsApiCasting order, margin, and liquidation branches", () => {
	function event(parsedJson: unknown, type = "0xperps::events::Test") {
		return {
			parsedJson,
			timestampMs: "1700000000123",
			id: { txDigest: "digest-event" },
			type,
		} as never;
	}

	it("casts liquidation and funding values from fixed wire integers", () => {
		const liquidation = PerpetualsApiCasting.liquidatedEventFromOnChain(
			event({
				ch_id: "0xabc",
				liqee_account_id: "9007199254740993",
				liqor_account_id: "42",
				is_liqee_long: true,
				base_liquidated: "2500000000000000000",
				quote_liquidated: "5000000000000000000000",
				liqee_pnl: "1500000000000000000",
				liquidation_fees: "200000000000000000",
				force_cancel_fees: "100000000000000000",
				insurance_fund_fees: "50000000000000000",
				bad_debt: "0",
			})
		);
		expect(liquidation).toMatchObject({
			accountId: 9_007_199_254_740_993n,
			liqorAccountId: 42n,
			marketId: PADDED_EVENT_MARKET_ID,
			baseLiquidated: 2.5,
			quoteLiquidated: 5000,
			liqeePnlUsd: 1.5,
			liquidationFeesUsd: 0.2,
			insuranceFundFeesUsd: 0.05,
			collateralDeltaUsd: 1.15,
			side: PerpetualsOrderSide.Bid,
			timestamp: 1_700_000_000_123,
		});

		const funding = PerpetualsApiCasting.settledFundingEventFromOnChain(
			event({
				account_id: "9007199254740993",
				ch_id: "0xabc",
				collateral_change_usd: "-125000000000000000",
				mkt_funding_rate_long: "10000000000000000",
				mkt_funding_rate_short: "-20000000000000000",
			})
		);
		expect(funding).toMatchObject({
			accountId: 9_007_199_254_740_993n,
			marketId: PADDED_EVENT_MARKET_ID,
			collateralDeltaUsd: -0.125,
			marketFundingRateLong: 0.01,
			marketFundingRateShort: -0.02,
		});
	});

	it("casts order side, expiry, fill completion, and taker margin deltas", () => {
		const askOrderId = "22763282186957586694186";
		const posted = PerpetualsApiCasting.postedOrderEventFromOnChain(
			event({
				ch_id: "0xabc",
				account_id: "7",
				order_id: askOrderId,
				order_size: "3000000000",
				reduce_only: true,
				expiration_timestamp_ms: null,
			})
		);
		expect(posted).toMatchObject({
			accountId: 7n,
			orderId: 22763282186957586694186n,
			side: PerpetualsOrderSide.Ask,
			size: 3_000_000_000n,
			reduceOnly: true,
			expiryTimestamp: undefined,
		});

		const filled = PerpetualsApiCasting.filledMakerOrdersEventFromOnChain(
			event({
				events: [
					{
						ch_id: "0xabc",
						maker_account_id: "7",
						taker_account_id: "8",
						fees: "10000000000000000",
						filled_size: "2000000000",
						order_id: askOrderId,
						pnl: "500000000000000000",
						remaining_size: "0",
						canceled_size: "0",
					},
					{
						ch_id: "0xabc",
						maker_account_id: "9",
						taker_account_id: "8",
						fees: "0",
						filled_size: "1000000000",
						order_id: "340282366920938440681645676400471965738",
						pnl: "0",
						remaining_size: "1000000000",
						canceled_size: "0",
					},
				],
			})
		);
		expect(filled.events).toEqual([
			expect.objectContaining({
				accountId: 7n,
				takerAccountId: 8n,
				orderId: 22763282186957586694186n,
				side: PerpetualsOrderSide.Ask,
				dropped: true,
				sizeRemaining: 0n,
				collateralDeltaUsd: 0.49,
			}),
			expect.objectContaining({
				accountId: 9n,
				side: PerpetualsOrderSide.Bid,
				dropped: false,
				sizeRemaining: 1_000_000_000n,
			}),
		]);

		const taker = PerpetualsApiCasting.filledTakerOrderEventFromOnChain(
			event({
				ch_id: "0xabc",
				taker_account_id: "7",
				taker_pnl: "500000000000000000",
				taker_fees: "100000000000000000",
				base_asset_delta_ask: "1000000000000000000",
				quote_asset_delta_ask: "500000000000000000000",
				base_asset_delta_bid: "3000000000000000000",
				quote_asset_delta_bid: "4500000000000000000000",
			})
		);
		expect(taker).toMatchObject({
			accountId: 7n,
			baseAssetDelta: 2,
			quoteAssetDelta: 4000,
			collateralDeltaUsd: 0.4,
			side: PerpetualsOrderSide.Bid,
		});
	});
});
