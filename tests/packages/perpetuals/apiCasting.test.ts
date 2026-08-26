import {
	ACCOUNT_ID,
	ACCOUNT_ID_ON_CHAIN,
	BID_ORDER_ID,
	BID_ORDER_ID_WIRE,
	describe,
	EVENT_TIMESTAMP,
	EVENT_TYPE,
	expect,
	FULL_ADDRESS,
	FULL_ID,
	it,
	onChainEvent,
	PerpetualsApiCasting,
	PerpetualsOrderSide,
	PerpetualsStopOrderType,
	SHORT_ADDRESS,
	SHORT_ID,
	TX_DIGEST,
} from "@test/packages/perpetuals/fixturesApi.js";

describe("PerpetualsApiCasting event boundary", () => {
	it("casts market version and collateral events with bigint fields", () => {
		expect(
			PerpetualsApiCasting.UpdatedMarketVersionEventFromOnChain(
				onChainEvent({ ch_id: SHORT_ID, version: "18446744073709551615" })
			)
		).toEqual({
			marketId: FULL_ID,
			version: 18446744073709551615n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.withdrewCollateralEventFromOnChain(
				onChainEvent({
					account_id: ACCOUNT_ID_ON_CHAIN,
					collateral: "12345678901234567890",
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			collateralDelta: 12345678901234567890n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.depositedCollateralEventFromOnChain(
				onChainEvent({ account_id: "42", collateral: "98765432109876543210" })
			)
		).toEqual({
			accountId: 42n,
			collateralDelta: 98765432109876543210n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts funding settlement and allocation events to public values", () => {
		expect(
			PerpetualsApiCasting.settledFundingEventFromOnChain(
				onChainEvent({
					account_id: ACCOUNT_ID_ON_CHAIN,
					ch_id: SHORT_ID,
					collateral_change_usd: "3000000000000000000",
					mkt_funding_rate_long: "250000000000000000",
					mkt_funding_rate_short: "500000000000000000",
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			collateralDeltaUsd: 3,
			marketId: FULL_ID,
			marketFundingRateLong: 0.25,
			marketFundingRateShort: 0.5,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.allocatedCollateralEventFromOnChain(
				onChainEvent({
					account_id: "7",
					ch_id: SHORT_ID,
					collateral: "1000000000000000001",
				})
			)
		).toEqual({
			accountId: 7n,
			marketId: FULL_ID,
			collateralDelta: 1000000000000000001n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.deallocatedCollateralEventFromOnChain(
				onChainEvent({
					account_id: "8",
					ch_id: SHORT_ID,
					collateral: "2",
				})
			)
		).toEqual({
			accountId: 8n,
			marketId: FULL_ID,
			collateralDelta: 2n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts liquidation events, including long and short side branches", () => {
		const fields = {
			ch_id: SHORT_ID,
			liqee_account_id: ACCOUNT_ID_ON_CHAIN,
			liqor_account_id: "17",
			is_liqee_long: true,
			base_liquidated: "2000000000000000000",
			quote_liquidated: "30000000000000000000",
			liqee_pnl: "10000000000000000000",
			liquidation_fees: "1000000000000000000",
			force_cancel_fees: "500000000000000000",
			insurance_fund_fees: "250000000000000000",
			bad_debt: "0",
		};
		expect(
			PerpetualsApiCasting.liquidatedEventFromOnChain(onChainEvent(fields))
		).toEqual({
			accountId: ACCOUNT_ID,
			collateralDeltaUsd: 8.25,
			liqorAccountId: 17n,
			marketId: FULL_ID,
			baseLiquidated: 2,
			quoteLiquidated: 30,
			liqeePnlUsd: 10,
			liquidationFeesUsd: 1,
			insuranceFundFeesUsd: 0.25,
			side: PerpetualsOrderSide.Bid,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.liquidatedEventFromOnChain(
				onChainEvent({ ...fields, is_liqee_long: false })
			)
		).toMatchObject({ side: PerpetualsOrderSide.Ask });
	});

	it("casts account and margin-ratio events", () => {
		expect(
			PerpetualsApiCasting.createdAccountEventFromOnChain(
				onChainEvent({ user: SHORT_ADDRESS, account_id: ACCOUNT_ID_ON_CHAIN })
			)
		).toEqual({
			user: FULL_ADDRESS,
			accountId: ACCOUNT_ID,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.SetPositionInitialMarginRatioEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					initial_margin_ratio: "125000000000000000",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			accountId: ACCOUNT_ID,
			initialMarginRatio: 0.125,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts order events and derives side, fill, and drop metadata", () => {
		expect(
			PerpetualsApiCasting.canceledOrderEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					size: "12345678901234567890",
					order_id: "1",
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			marketId: FULL_ID,
			side: PerpetualsOrderSide.Ask,
			size: 12345678901234567890n,
			orderId: 1n,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.filledMakerOrdersEventFromOnChain(
				onChainEvent({
					events: [
						{
							ch_id: SHORT_ID,
							maker_account_id: "1",
							taker_account_id: "2",
							fees: "750000000000000000",
							filled_size: "12345678901234567890",
							order_id: BID_ORDER_ID_WIRE,
							pnl: "5000000000000000000",
							remaining_size: "0",
							canceled_size: "3",
						},
					],
				})
			)
		).toEqual({
			events: [
				{
					accountId: 1n,
					takerAccountId: 2n,
					collateralDeltaUsd: 4.25,
					pnlUsd: 5,
					feesUsd: 0.75,
					marketId: FULL_ID,
					orderId: BID_ORDER_ID,
					side: PerpetualsOrderSide.Bid,
					size: 12345678901234567890n,
					dropped: true,
					sizeRemaining: 0n,
					canceledSize: 3n,
				},
			],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts taker fills with both derived position sides", () => {
		const base = {
			ch_id: SHORT_ID,
			taker_account_id: ACCOUNT_ID_ON_CHAIN,
			taker_pnl: "2000000000000000000",
			taker_fees: "500000000000000000",
			base_asset_delta_bid: "3000000000000000000",
			quote_asset_delta_bid: "10000000000000000000",
			base_asset_delta_ask: "1000000000000000000",
			quote_asset_delta_ask: "2000000000000000000",
		};
		const bid = PerpetualsApiCasting.filledTakerOrderEventFromOnChain(
			onChainEvent(base)
		);
		expect(bid).toEqual({
			baseAssetDelta: 2,
			accountId: ACCOUNT_ID,
			collateralDeltaUsd: 1.5,
			takerPnlUsd: 2,
			takerFeesUsd: 0.5,
			marketId: FULL_ID,
			side: PerpetualsOrderSide.Bid,
			quoteAssetDelta: 8,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		const ask = PerpetualsApiCasting.filledTakerOrderEventFromOnChain(
			onChainEvent({
				...base,
				base_asset_delta_bid: "1000000000000000000",
				base_asset_delta_ask: "3000000000000000000",
			})
		);
		expect(ask.side).toBe(PerpetualsOrderSide.Ask);
		expect(ask.baseAssetDelta).toBe(-2);
	});

	it("preserves optional posted-order expiration semantics", () => {
		const common = {
			ch_id: SHORT_ID,
			account_id: ACCOUNT_ID_ON_CHAIN,
			order_id: "1",
			order_size: "90",
			reduce_only: false,
		};
		const withoutExpiry = PerpetualsApiCasting.postedOrderEventFromOnChain(
			onChainEvent({ ...common, expiration_timestamp_ms: null })
		);
		const withExpiry = PerpetualsApiCasting.postedOrderEventFromOnChain(
			onChainEvent({ ...common, expiration_timestamp_ms: "1700000000999" })
		);

		expect(withoutExpiry).toMatchObject({
			accountId: ACCOUNT_ID,
			marketId: FULL_ID,
			size: 90n,
			orderId: 1n,
			side: PerpetualsOrderSide.Ask,
			reduceOnly: false,
		});
		expect(withoutExpiry.expiryTimestamp).toBeUndefined();
		expect(withExpiry.expiryTimestamp).toBe(1700000000999n);

		expect(
			PerpetualsApiCasting.reducedOrderEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					size_change: "12345678901234567890",
					order_id: BID_ORDER_ID_WIRE,
				})
			)
		).toEqual({
			accountId: ACCOUNT_ID,
			marketId: FULL_ID,
			sizeChange: 12345678901234567890n,
			orderId: BID_ORDER_ID,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts stop-order ticket lifecycle events and optional subaccounts", () => {
		expect(
			PerpetualsApiCasting.createdStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: null,
					executors: [SHORT_ADDRESS],
					gas: "12345678901234567890",
					stop_order_type: "1",
					encrypted_details: [0, 255],
				})
			)
		).toEqual({
			ticketId: FULL_ID,
			accountId: ACCOUNT_ID,
			executors: [FULL_ADDRESS],
			gas: 12345678901234567890n,
			stopOrderType: PerpetualsStopOrderType.Standalone,
			encryptedDetails: [0, 255],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.executedStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					executor: SHORT_ADDRESS,
				})
			)
		).toEqual({
			ticketId: FULL_ID,
			executor: FULL_ADDRESS,
			accountId: ACCOUNT_ID,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		const deletedWithoutSubaccount =
			PerpetualsApiCasting.deletedStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: null,
					executor: SHORT_ADDRESS,
				})
			);
		const deletedWithSubaccount =
			PerpetualsApiCasting.deletedStopOrderTicketEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: SHORT_ID,
					executor: SHORT_ADDRESS,
				})
			);
		expect(deletedWithoutSubaccount.subAccountId).toBeUndefined();
		expect(deletedWithSubaccount.subAccountId).toBe(FULL_ID);
	});

	it("casts edited stop-order details and executor sets", () => {
		const details =
			PerpetualsApiCasting.editedStopOrderTicketDetailsEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: SHORT_ID,
					stop_order_type: "0",
					encrypted_details: [1, 2, 3],
				})
			);
		expect(details).toEqual({
			ticketId: FULL_ID,
			stopOrderType: PerpetualsStopOrderType.SlTp,
			accountId: ACCOUNT_ID,
			subAccountId: FULL_ID,
			encryptedDetails: [1, 2, 3],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		const executors =
			PerpetualsApiCasting.editedStopOrderTicketExecutorEventFromOnChain(
				onChainEvent({
					ticket_id: SHORT_ID,
					account_id: ACCOUNT_ID_ON_CHAIN,
					subaccount_id: null,
					executors: [SHORT_ADDRESS, FULL_ADDRESS],
				})
			);
		expect(executors).toEqual({
			ticketId: FULL_ID,
			accountId: ACCOUNT_ID,
			subAccountId: undefined,
			executors: [FULL_ADDRESS, FULL_ADDRESS],
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});

	it("casts premium, spread, and cumulative funding TWAP events", () => {
		expect(
			PerpetualsApiCasting.updatedPremiumTwapEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					index_price: "100000000000000000000",
					book_price: "101000000000000000000",
					premium_twap: "2500000000000000000",
					premium_twap_last_upd_ms: "1700000000999",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			indexPrice: 100,
			bookPrice: 101,
			premiumTwap: 2.5,
			premiumTwapLastUpdateMs: 1_700_000_000_999,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.updatedSpreadTwapEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					book_price: "101000000000000000000",
					index_price: "100000000000000000000",
					spread_twap: "1000000000000000000",
					spread_twap_last_upd_ms: "1700000001000",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			bookPrice: 101,
			indexPrice: 100,
			spreadTwap: 1,
			spreadTwapLastUpdateMs: 1_700_000_001_000,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});

		expect(
			PerpetualsApiCasting.updatedFundingEventFromOnChain(
				onChainEvent({
					ch_id: SHORT_ID,
					cum_funding_rate_long: "125000000000000000",
					cum_funding_rate_short: "250000000000000000",
					funding_last_upd_ms: "1700000002000",
				})
			)
		).toEqual({
			marketId: FULL_ID,
			cumFundingRateLong: 0.125,
			cumFundingRateShort: 0.25,
			fundingLastUpdateMs: 1_700_000_002_000,
			timestamp: EVENT_TIMESTAMP,
			txnDigest: TX_DIGEST,
			type: EVENT_TYPE,
		});
	});
});
