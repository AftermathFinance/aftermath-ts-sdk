import { Casting, Helpers } from "../../../general/utils";
import { Perpetuals } from "../..";
import type {
	AllocatedCollateralEventOnChain,
	CanceledOrderEventOnChain,
	CreatedAccountEventOnChain,
	CreatedStopOrderTicketEventOnChain,
	DeallocatedCollateralEventOnChain,
	DeletedStopOrderTicketEventOnChain,
	DepositedCollateralEventOnChain,
	// AddedStopOrderTicketCollateralEventOnChain,
	// RemovedStopOrderTicketCollateralEventOnChain,
	EditedStopOrderTicketDetailsEventOnChain,
	// ReceivedCollateralEventOnChain,
	// TransferredDeallocatedCollateralEventOnChain,
	EditedStopOrderTicketExecutorEventOnChain,
	ExecutedStopOrderTicketEventOnChain,
	FilledMakerOrdersEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	PostedOrderEventOnChain,
	ReducedOrderEventOnChain,
	SetPositionInitialMarginRatioEventOnChain,
	SettledFundingEventOnChain,
	UpdatedFundingEventOnChain,
	UpdatedMarketVersionEventOnChain,
	UpdatedPremiumTwapEventOnChain,
	UpdatedSpreadTwapEventOnChain,
	WithdrewCollateralEventOnChain,
} from "../perpetualsCastingTypes";
import {
	type AllocatedCollateralEvent,
	type CanceledOrderEvent,
	type CreatedAccountEvent,
	type CreatedStopOrderTicketEvent,
	type DeallocatedCollateralEvent,
	type DeletedStopOrderTicketEvent,
	type DepositedCollateralEvent,
	// AddedStopOrderTicketCollateralEvent,
	// RemovedStopOrderTicketCollateralEvent,
	type EditedStopOrderTicketDetailsEvent,
	type EditedStopOrderTicketExecutorEvent,
	type ExecutedStopOrderTicketEvent,
	type FilledMakerOrdersEvent,
	type FilledTakerOrderEvent,
	type LiquidatedEvent,
	PerpetualsOrderSide,
	type PerpetualsStopOrderType,
	type PostedOrderEvent,
	type ReducedOrderEvent,
	type SetPositionInitialMarginRatioEvent,
	type SettledFundingEvent,
	type UpdatedFundingEvent,
	type UpdatedMarketVersionEvent,
	type UpdatedPremiumTwapEvent,
	type UpdatedSpreadTwapEvent,
	type WithdrewCollateralEvent,
	// CreatedSubAccountEvent,
	// SetSubAccountUsersEvent,
} from "../perpetualsTypes";

// TODO: handle 0xs and leading 0s everywhere
/**
 * Converts raw Sui perpetuals events into the SDK's camel-case event types.
 *
 * These static helpers do not perform network I/O. They convert bigint-like
 * strings and fixed-point strings from `parsedJson`, preserve the event
 * timestamp in milliseconds, and copy the transaction digest and event type.
 */
export class PerpetualsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Account
	// =========================================================================

	// public static partialPositionFromRaw = (
	// 	data: any
	// ): Omit<PerpetualsPosition, "collateralCoinType" | "marketId"> => {
	// 	return {
	// 		collateral: BigInt(data.collateral),
	// 		baseAssetAmount: BigInt(data.baseAssetAmount),
	// 		quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
	// 		cumFundingRateLong: BigInt(data.cumFundingRateLong),
	// 		cumFundingRateShort: BigInt(data.cumFundingRateShort),
	// 		asksQuantity: BigInt(data.asksQuantity),
	// 		bidsQuantity: BigInt(data.bidsQuantity),
	// 		pendingOrders: BigInt(data.pendingOrders),
	// 		makerFee: BigInt(data.makerFee),
	// 		takerFee: BigInt(data.takerFee),
	// 	};
	// };

	// =========================================================================
	//  Orderbook
	// =========================================================================

	// public static orderbookPriceFromBytes = (bytes: number[]): number => {
	// 	const unwrapped = bcs.option(bcs.u256()).parse(new Uint8Array(bytes));
	// 	return FixedUtils.directCast(
	// 		unwrapped != null ? BigInt(unwrapped) : BigInt(0)
	// 	);
	// };

	// public static orderInfoFromRaw = (data: any): PerpetualsOrderInfo => {
	// 	return {
	// 		price: BigInt(data.price),
	// 		size: BigInt(data.size),
	// 	};
	// };

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Updated Version
	// =========================================================================

	/** Casts a raw clearing-house version update event. */
	public static UpdatedMarketVersionEventFromOnChain = (
		eventOnChain: UpdatedMarketVersionEventOnChain
	): UpdatedMarketVersionEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			version: BigInt(fields.version),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Collateral
	// =========================================================================

	/** Casts a raw collateral-withdrawal event. */
	public static withdrewCollateralEventFromOnChain = (
		eventOnChain: WithdrewCollateralEventOnChain
	): WithdrewCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			collateralDelta: BigInt(fields.collateral),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw collateral-deposit event. */
	public static depositedCollateralEventFromOnChain = (
		eventOnChain: DepositedCollateralEventOnChain
	): DepositedCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			collateralDelta: BigInt(fields.collateral),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw funding-settlement event and converts fixed-point USD values. */
	public static settledFundingEventFromOnChain = (
		eventOnChain: SettledFundingEventOnChain
	): SettledFundingEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			collateralDeltaUsd: Casting.IFixed.numberFromIFixed(
				BigInt(fields.collateral_change_usd)
			),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			marketFundingRateLong: Casting.IFixed.numberFromIFixed(
				BigInt(fields.mkt_funding_rate_long)
			),
			marketFundingRateShort: Casting.IFixed.numberFromIFixed(
				BigInt(fields.mkt_funding_rate_short)
			),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw collateral-allocation event. */
	public static allocatedCollateralEventFromOnChain = (
		eventOnChain: AllocatedCollateralEventOnChain
	): AllocatedCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			collateralDelta: BigInt(fields.collateral),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw collateral-deallocation event. */
	public static deallocatedCollateralEventFromOnChain = (
		eventOnChain: DeallocatedCollateralEventOnChain
	): DeallocatedCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			collateralDelta: BigInt(fields.collateral),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Liquidation
	// =========================================================================

	/** Casts a raw liquidation event and derives the liquidated side and USD fields. */
	public static liquidatedEventFromOnChain = (
		eventOnChain: LiquidatedEventOnChain
	): LiquidatedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.liqee_account_id),
			collateralDeltaUsd:
				Casting.IFixed.numberFromIFixed(BigInt(fields.liqee_pnl)) -
				Casting.IFixed.numberFromIFixed(BigInt(fields.liquidation_fees)) -
				Casting.IFixed.numberFromIFixed(BigInt(fields.force_cancel_fees)) -
				Casting.IFixed.numberFromIFixed(BigInt(fields.insurance_fund_fees)),
			liqorAccountId: BigInt(fields.liqor_account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			baseLiquidated: Casting.IFixed.numberFromIFixed(
				BigInt(fields.base_liquidated)
			),
			quoteLiquidated: Casting.IFixed.numberFromIFixed(
				BigInt(fields.quote_liquidated)
			),
			liqeePnlUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.liqee_pnl)),
			liquidationFeesUsd: Casting.IFixed.numberFromIFixed(
				BigInt(fields.liquidation_fees)
			),
			insuranceFundFeesUsd: Casting.IFixed.numberFromIFixed(
				BigInt(fields.insurance_fund_fees)
			),
			side: fields.is_liqee_long
				? PerpetualsOrderSide.Bid
				: PerpetualsOrderSide.Ask,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Account
	// =========================================================================

	/** Casts a raw account-creation event. */
	public static createdAccountEventFromOnChain = (
		eventOnChain: CreatedAccountEventOnChain
	): CreatedAccountEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			user: Helpers.addLeadingZeroesToType(fields.user),
			accountId: BigInt(fields.account_id),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// public static createdSubAccountEventFromOnChain = (
	// 	eventOnChain: CreatedSubAccountEventOnChain
	// ): CreatedSubAccountEvent => {
	// 	const fields = eventOnChain.parsedJson;
	// 	return {
	// 		users: fields.users.map((user) =>
	// 			Helpers.addLeadingZeroesToType(user)
	// 		),
	// 		accountId: BigInt(fields.account_id),
	// 		subAccountId: Helpers.addLeadingZeroesToType(fields.subaccount_id),
	// 		timestamp: Number(eventOnChain.timestampMs),
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };

	// public static setSubAccountUsersEventFromOnChain = (
	// 	eventOnChain: SetSubAccountUsersEventOnChain
	// ): SetSubAccountUsersEvent => {
	// 	const fields = eventOnChain.parsedJson;
	// 	return {
	// 		users: fields.users.map((user) =>
	// 			Helpers.addLeadingZeroesToType(user)
	// 		),
	// 		accountId: BigInt(fields.account_id),
	// 		subAccountId: Helpers.addLeadingZeroesToType(fields.subaccount_id),
	// 		timestamp: Number(eventOnChain.timestampMs),
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };

	/** Casts a raw position initial-margin-ratio update event. */
	public static SetPositionInitialMarginRatioEventFromOnChain = (
		eventOnChain: SetPositionInitialMarginRatioEventOnChain
	): SetPositionInitialMarginRatioEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			accountId: BigInt(fields.account_id),
			initialMarginRatio: Casting.IFixed.numberFromIFixed(
				BigInt(fields.initial_margin_ratio)
			),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Order
	// =========================================================================

	/** Casts a raw order-cancellation event and derives the order side from its ID. */
	public static canceledOrderEventFromOnChain = (
		eventOnChain: CanceledOrderEventOnChain
	): CanceledOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
			size: BigInt(fields.size),
			orderId: BigInt(fields.order_id),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw aggregate maker-fill event into per-order fill records. */
	public static filledMakerOrdersEventFromOnChain = (
		eventOnChain: FilledMakerOrdersEventOnChain
	): FilledMakerOrdersEvent => {
		return {
			events: eventOnChain.parsedJson.events.map((fields) => ({
				accountId: BigInt(fields.maker_account_id),
				takerAccountId: BigInt(fields.taker_account_id),
				collateralDeltaUsd:
					Casting.IFixed.numberFromIFixed(BigInt(fields.pnl)) -
					Casting.IFixed.numberFromIFixed(BigInt(fields.fees)),
				pnlUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.pnl)),
				feesUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.fees)),
				marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
				orderId: BigInt(fields.order_id),
				side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
				size: BigInt(fields.filled_size),
				dropped: BigInt(fields.remaining_size) === BigInt(0),
				sizeRemaining: BigInt(fields.remaining_size),
				canceledSize: BigInt(fields.canceled_size),
			})),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw taker-fill event and derives signed base and quote deltas. */
	public static filledTakerOrderEventFromOnChain = (
		eventOnChain: FilledTakerOrderEventOnChain
	): FilledTakerOrderEvent => {
		const fields = eventOnChain.parsedJson;
		const baseAssetDelta =
			Casting.IFixed.numberFromIFixed(BigInt(fields.base_asset_delta_bid)) -
			Casting.IFixed.numberFromIFixed(BigInt(fields.base_asset_delta_ask));
		return {
			baseAssetDelta,
			accountId: BigInt(fields.taker_account_id),
			collateralDeltaUsd:
				Casting.IFixed.numberFromIFixed(BigInt(fields.taker_pnl)) -
				Casting.IFixed.numberFromIFixed(BigInt(fields.taker_fees)),
			takerPnlUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.taker_pnl)),
			takerFeesUsd: Casting.IFixed.numberFromIFixed(BigInt(fields.taker_fees)),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			side: Perpetuals.positionSide({ baseAssetAmount: baseAssetDelta }),
			quoteAssetDelta:
				Casting.IFixed.numberFromIFixed(BigInt(fields.quote_asset_delta_bid)) -
				Casting.IFixed.numberFromIFixed(BigInt(fields.quote_asset_delta_ask)),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw posted-order event, including an optional expiry timestamp. */
	public static postedOrderEventFromOnChain = (
		eventOnChain: PostedOrderEventOnChain
	): PostedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			size: BigInt(fields.order_size),
			orderId: BigInt(fields.order_id),
			side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
			reduceOnly: fields.reduce_only,
			expiryTimestamp: fields.expiration_timestamp_ms
				? BigInt(fields.expiration_timestamp_ms)
				: undefined,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw order-reduction event. */
	public static reducedOrderEventFromOnChain = (
		eventOnChain: ReducedOrderEventOnChain
	): ReducedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			sizeChange: BigInt(fields.size_change),
			orderId: BigInt(fields.order_id),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Stop Orders
	// =========================================================================

	/** Casts a raw stop-order ticket creation event. */
	public static createdStopOrderTicketEventFromOnChain = (
		eventOnChain: CreatedStopOrderTicketEventOnChain
	): CreatedStopOrderTicketEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			ticketId: Helpers.addLeadingZeroesToType(fields.ticket_id),
			accountId: BigInt(fields.account_id),
			executors: fields.executors.map((executor) =>
				Helpers.addLeadingZeroesToType(executor)
			),
			gas: BigInt(fields.gas),
			stopOrderType: Number(fields.stop_order_type) as PerpetualsStopOrderType,
			encryptedDetails: fields.encrypted_details,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw stop-order ticket execution event. */
	public static executedStopOrderTicketEventFromOnChain = (
		eventOnChain: ExecutedStopOrderTicketEventOnChain
	): ExecutedStopOrderTicketEvent => {
		const f = eventOnChain.parsedJson;
		return {
			ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
			executor: Helpers.addLeadingZeroesToType(f.executor),
			accountId: BigInt(f.account_id),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw stop-order ticket deletion event. */
	public static deletedStopOrderTicketEventFromOnChain = (
		eventOnChain: DeletedStopOrderTicketEventOnChain
	): DeletedStopOrderTicketEvent => {
		const f = eventOnChain.parsedJson;
		return {
			ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
			executor: Helpers.addLeadingZeroesToType(f.executor),
			accountId: BigInt(f.account_id),
			subAccountId: f.subaccount_id
				? Helpers.addLeadingZeroesToType(f.subaccount_id)
				: undefined,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw stop-order ticket detail-edit event. */
	public static editedStopOrderTicketDetailsEventFromOnChain = (
		eventOnChain: EditedStopOrderTicketDetailsEventOnChain
	): EditedStopOrderTicketDetailsEvent => {
		const f = eventOnChain.parsedJson;
		return {
			ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
			stopOrderType: Number(f.stop_order_type) as PerpetualsStopOrderType,
			accountId: BigInt(f.account_id),
			subAccountId: f.subaccount_id
				? Helpers.addLeadingZeroesToType(f.subaccount_id)
				: undefined,
			encryptedDetails: f.encrypted_details,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw stop-order ticket executor-edit event. */
	public static editedStopOrderTicketExecutorEventFromOnChain = (
		eventOnChain: EditedStopOrderTicketExecutorEventOnChain
	): EditedStopOrderTicketExecutorEvent => {
		const f = eventOnChain.parsedJson;
		return {
			ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
			accountId: BigInt(f.account_id),
			subAccountId: f.subaccount_id
				? Helpers.addLeadingZeroesToType(f.subaccount_id)
				: undefined,
			executors: f.executors.map((executor) =>
				Helpers.addLeadingZeroesToType(executor)
			),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// public static addedStopOrderTicketCollateralEventFromOnChain = (
	// 	eventOnChain: AddedStopOrderTicketCollateralEventOnChain
	// ): AddedStopOrderTicketCollateralEvent => {
	// 	const f = eventOnChain.parsedJson;
	// 	return {
	// 		ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
	// 		accountId: BigInt(f.account_id),
	// 		subAccountId: f.subaccount_id
	// 			? Helpers.addLeadingZeroesToType(f.subaccount_id)
	// 			: undefined,
	// 		collateralToAllocate: BigInt(f.collateral_to_allocate),
	// 		timestamp: Number(eventOnChain.timestampMs),
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };

	// public static removedStopOrderTicketCollateralEventFromOnChain = (
	// 	eventOnChain: RemovedStopOrderTicketCollateralEventOnChain
	// ): RemovedStopOrderTicketCollateralEvent => {
	// 	const f = eventOnChain.parsedJson;
	// 	return {
	// 		ticketId: Helpers.addLeadingZeroesToType(f.ticket_id),
	// 		accountId: BigInt(f.account_id),
	// 		subAccountId: f.subaccount_id
	// 			? Helpers.addLeadingZeroesToType(f.subaccount_id)
	// 			: undefined,
	// 		collateralToRemove: BigInt(f.collateral_to_remove),
	// 		timestamp: Number(eventOnChain.timestampMs),
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };

	// public static transferredDeallocatedCollateralEventFromOnChain = (
	// 	eventOnChain: TransferredDeallocatedCollateralEventOnChain
	// ): TransferredDeallocatedCollateralEvent => {
	// 	const f = eventOnChain.parsedJson;
	// 	return {
	// 		chId: Helpers.addLeadingZeroesToType(f.ch_id),
	// 		objectId: Helpers.addLeadingZeroesToType(f.obj_id),
	// 		accountId: BigInt(f.account_id),
	// 		collateral: BigInt(f.collateral),
	// 		timestamp: Number(eventOnChain.timestampMs),
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };

	// public static receivedCollateralEventFromOnChain = (
	// 	eventOnChain: ReceivedCollateralEventOnChain
	// ): ReceivedCollateralEvent => {
	// 	const f = eventOnChain.parsedJson;
	// 	return {
	// 		objectId: Helpers.addLeadingZeroesToType(f.obj_id),
	// 		accountId: BigInt(f.account_id),
	// 		collateral: BigInt(f.collateral),
	// 		timestamp: Number(eventOnChain.timestampMs),
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };

	// =========================================================================
	//  Twap
	// =========================================================================

	/** Casts a raw premium TWAP update event. */
	public static updatedPremiumTwapEventFromOnChain = (
		eventOnChain: UpdatedPremiumTwapEventOnChain
	): UpdatedPremiumTwapEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			indexPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.index_price)),
			bookPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.book_price)),
			premiumTwap: Casting.IFixed.numberFromIFixed(BigInt(fields.premium_twap)),
			premiumTwapLastUpdateMs: Number(fields.premium_twap_last_upd_ms),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	/** Casts a raw spread TWAP update event. */
	public static updatedSpreadTwapEventFromOnChain = (
		eventOnChain: UpdatedSpreadTwapEventOnChain
	): UpdatedSpreadTwapEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			bookPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.book_price)),
			indexPrice: Casting.IFixed.numberFromIFixed(BigInt(fields.index_price)),
			spreadTwap: Casting.IFixed.numberFromIFixed(BigInt(fields.spread_twap)),
			spreadTwapLastUpdateMs: Number(fields.spread_twap_last_upd_ms),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Funding
	// =========================================================================

	/** Casts a raw cumulative funding-rate update event. */
	public static updatedFundingEventFromOnChain = (
		eventOnChain: UpdatedFundingEventOnChain
	): UpdatedFundingEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			cumFundingRateLong: Casting.IFixed.numberFromIFixed(
				BigInt(fields.cum_funding_rate_long)
			),
			cumFundingRateShort: Casting.IFixed.numberFromIFixed(
				BigInt(fields.cum_funding_rate_short)
			),
			fundingLastUpdateMs: Number(fields.funding_last_upd_ms),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}
