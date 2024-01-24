import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	PerpetualsMarketState,
	PerpetualsOrderbook,
	PerpetualsOrder,
	PerpetualsOrderedMap,
	PerpetualsMarketParams,
	PerpetualsAccountObject,
	PerpetualsPosition,
	perpetualsBcsRegistry,
	PerpetualsAccountCap,
	DepositedCollateralEvent,
	WithdrewCollateralEvent,
	CreatedAccountEvent,
	CanceledOrderEvent,
	PostedOrderEvent,
	PerpetualsOrderSide,
	FilledTakerOrderEvent,
	FilledMakerOrderEvent,
	PerpetualsOrderInfo,
	SettledFundingEvent,
	UpdatedSpreadTwapEvent,
	UpdatedPremiumTwapEvent,
	LiquidatedEvent,
	PerpetualsMarketData,
	PostedOrderReceiptEvent,
	PerpetualsRawAccountCap,
	AllocatedCollateralEvent,
	DeallocatedCollateralEvent,
} from "../perpetualsTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Coin, Perpetuals } from "../..";
import { CoinType } from "../../coin/coinTypes";
import { FixedUtils } from "../../../general/utils/fixedUtils";
import {
	CanceledOrderEventOnChain,
	CreatedAccountEventOnChain,
	DepositedCollateralEventOnChain,
	PostedOrderEventOnChain,
	WithdrewCollateralEventOnChain,
	FilledMakerOrderEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	SettledFundingEventOnChain,
	UpdatedPremiumTwapEventOnChain,
	UpdatedSpreadTwapEventOnChain,
	PostedOrderReceiptEventOnChain,
	AllocatedCollateralEventOnChain,
	DeallocatedCollateralEventOnChain,
} from "../perpetualsCastingTypes";
import { BigIntAsString } from "../../../types";

// TODO: handle 0xs and leading 0s everywhere
export class PerpetualsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Account
	// =========================================================================

	public static rawAccountCapFromRaw(
		data: any,
		collateralCoinType: CoinType
	): PerpetualsRawAccountCap {
		return {
			collateralCoinType,
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
			accountId: BigInt(data.accountId),
			collateral: BigInt(data.collateral.value),
		};
	}

	public static partialPositionFromRaw = (
		data: any
	): Omit<PerpetualsPosition, "collateralCoinType" | "marketId"> => {
		return {
			collateral: BigInt(data.collateral),
			baseAssetAmount: BigInt(data.baseAssetAmount),
			quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			asksQuantity: BigInt(data.asksQuantity),
			bidsQuantity: BigInt(data.bidsQuantity),
			pendingOrders: BigInt(data.pendingOrders),
			makerFee: BigInt(data.makerFee),
			takerFee: BigInt(data.takerFee),
		};
	};

	// =========================================================================
	//  Clearing House
	// =========================================================================

	public static clearingHouseFromRaw(
		data: any,
		collateralCoinType: CoinType
	): PerpetualsMarketData {
		return {
			collateralCoinType,
			objectId: Helpers.addLeadingZeroesToType("0x" + data.id),
			objectType: data.objectType,
			marketParams: this.marketParamsFromRaw(data.marketParams),
			marketState: this.marketStateFromRaw(data.marketState),
		};
	}

	private static marketParamsFromRaw = (
		data: any
	): PerpetualsMarketParams => {
		return {
			baseAssetSymbol: data.baseAssetSymbol,
			marginRatioInitial: BigInt(data.marginRatioInitial),
			marginRatioMaintenance: BigInt(data.marginRatioMaintenance),
			fundingFrequencyMs: BigInt(data.fundingFrequencyMs),
			fundingPeriodMs: BigInt(data.fundingPeriodMs),
			premiumTwapFrequencyMs: BigInt(data.premiumTwapFrequencyMs),
			premiumTwapPeriodMs: BigInt(data.premiumTwapPeriodMs),
			spreadTwapFrequencyMs: BigInt(data.spreadTwapFrequencyMs),
			spreadTwapPeriodMs: BigInt(data.spreadTwapPeriodMs),
			makerFee: BigInt(data.makerFee),
			takerFee: BigInt(data.takerFee),
			liquidationFee: BigInt(data.liquidationFee),
			forceCancelFee: BigInt(data.forceCancelFee),
			insuranceFundFee: BigInt(data.insuranceFundFee),
			lotSize: BigInt(data.lotSize),
			tickSize: BigInt(data.tickSize),
			liquidationTolerance: BigInt(data.liquidationTolerance),
			maxPendingOrdersPerPosition: BigInt(
				data.maxPendingOrdersPerPosition
			),
			minOrderUsdValue: BigInt(data.minOrderUsdValue),
		};
	};

	private static marketStateFromRaw = (data: any): PerpetualsMarketState => {
		return {
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			fundingLastUpdMs: Number(data.fundingLastUpdMs),
			premiumTwap: BigInt(data.premiumTwap),
			premiumTwapLastUpdMs: Number(data.premiumTwapLastUpdMs),
			spreadTwap: BigInt(data.spreadTwap),
			spreadTwapLastUpdMs: Number(data.spreadTwapLastUpdMs),
			openInterest: BigInt(data.openInterest),
			feesAccrued: BigInt(data.feesAccrued),
		};
	};

	// =========================================================================
	//  Orderbook
	// =========================================================================

	public static orderbookPriceFromBytes = (bytes: number[]): number => {
		const unwrapped: BigIntAsString | undefined =
			Casting.unwrapDeserializedOption(
				perpetualsBcsRegistry.de("Option<u256>", new Uint8Array(bytes))
			);
		return FixedUtils.directCast(
			unwrapped !== undefined ? BigInt(unwrapped) : BigInt(0)
		);
	};

	public static orderInfoFromRaw = (data: any): PerpetualsOrderInfo => {
		return {
			price: BigInt(data.price),
			size: BigInt(data.size),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Collateral
	// =========================================================================

	public static withdrewCollateralEventFromOnChain = (
		eventOnChain: WithdrewCollateralEventOnChain
	): WithdrewCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			collateralDelta: BigInt(fields.collateral),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static depositedCollateralEventFromOnChain = (
		eventOnChain: DepositedCollateralEventOnChain
	): DepositedCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			collateralDelta: BigInt(fields.collateral),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static settledFundingEventFromOnChain = (
		eventOnChain: SettledFundingEventOnChain
	): SettledFundingEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			collateralDeltaUsd: BigInt(fields.collateral_change_usd),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			marketFundingRateLong: BigInt(fields.mkt_funding_rate_long),
			marketFundingRateShort: BigInt(fields.mkt_funding_rate_short),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static allocatedCollateralEventFromOnChain = (
		eventOnChain: AllocatedCollateralEventOnChain
	): AllocatedCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			collateralDelta: BigInt(fields.collateral),
			positionCollateralAfter: BigInt(fields.position_collateral_after),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static deallocatedCollateralEventFromOnChain = (
		eventOnChain: DeallocatedCollateralEventOnChain
	): DeallocatedCollateralEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			collateralDelta: BigInt(fields.collateral),
			positionCollateralAfter: BigInt(fields.position_collateral_after),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Liquidation
	// =========================================================================

	public static liquidatedEventFromOnChain = (
		eventOnChain: LiquidatedEventOnChain
	): LiquidatedEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.liqee_account_id),
			collateralDeltaUsd: BigInt(fields.liqee_collateral_change_usd),
			liqorAccountId: BigInt(fields.liqor_account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			markPrice: BigInt(fields.mark_price),
			size: BigInt(fields.size_liquidated),
			side: fields.is_liqee_long
				? PerpetualsOrderSide.Bid
				: PerpetualsOrderSide.Ask,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Account
	// =========================================================================

	public static createdAccountEventFromOnChain = (
		eventOnChain: CreatedAccountEventOnChain
	): CreatedAccountEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			user: Helpers.addLeadingZeroesToType(fields.user),
			accountId: BigInt(fields.account_id),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Order
	// =========================================================================

	public static canceledOrderEventFromOnChain = (
		eventOnChain: CanceledOrderEventOnChain
	): CanceledOrderEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
			size: BigInt(fields.size),
			orderId: BigInt(fields.order_id),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static postedOrderEventFromOnChain = (
		eventOnChain: PostedOrderEventOnChain
	): PostedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			side:
				BigInt(fields.posted_base_ask) > BigInt(fields.posted_base_bid)
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			size: BigInt(fields.posted_base_ask + fields.posted_base_bid),
			asksQuantity: BigInt(fields.pending_asks),
			bidsQuantity: BigInt(fields.pending_bids),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static filledMakerOrderEventFromOnChain = (
		eventOnChain: FilledMakerOrderEventOnChain
	): FilledMakerOrderEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			baseAssetAmount: BigInt(fields.maker_base_amount),
			accountId: BigInt(fields.maker_account_id),
			collateralDeltaUsd: BigInt(fields.collateral_change_usd),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			orderId: BigInt(fields.order_id),
			side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
			size: BigInt(fields.maker_size),
			dropped: fields.dropped,
			quoteAssetNotionalAmount: BigInt(fields.maker_quote_amount),
			asksQuantity: BigInt(fields.maker_pending_asks_quantity),
			bidsQuantity: BigInt(fields.maker_pending_bids_quantity),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static filledTakerOrderEventFromOnChain = (
		eventOnChain: FilledTakerOrderEventOnChain
	): FilledTakerOrderEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		const baseAssetDelta = Casting.IFixed.iFixedFromNumber(
			Casting.IFixed.numberFromIFixed(
				BigInt(fields.base_asset_delta_bid)
			) -
				Casting.IFixed.numberFromIFixed(
					BigInt(fields.base_asset_delta_ask)
				)
		);
		return {
			collateralCoinType,
			baseAssetDelta,
			accountId: BigInt(fields.taker_account_id),
			collateralDeltaUsd: BigInt(fields.collateral_change_usd),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			baseAssetAmount: BigInt(fields.taker_base_amount),
			quoteAssetNotionalAmount: BigInt(fields.taker_quote_amount),
			side: Perpetuals.positionSide({ baseAssetAmount: baseAssetDelta }),
			quoteAssetDelta: Casting.IFixed.iFixedFromNumber(
				Casting.IFixed.numberFromIFixed(
					BigInt(fields.quote_asset_delta_bid)
				) -
					Casting.IFixed.numberFromIFixed(
						BigInt(fields.quote_asset_delta_ask)
					)
			),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static postedOrderReceiptEventFromOnChain = (
		eventOnChain: PostedOrderReceiptEventOnChain
	): PostedOrderReceiptEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			accountId: BigInt(fields.account_id),
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			size: BigInt(fields.order_size),
			orderId: BigInt(fields.order_id),
			side: Perpetuals.orderIdToSide(BigInt(fields.order_id)),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Twap
	// =========================================================================

	public static updatedPremiumTwapEventFromOnChain = (
		eventOnChain: UpdatedPremiumTwapEventOnChain
	): UpdatedPremiumTwapEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			indexPrice: BigInt(fields.index_price),
			bookPrice: BigInt(fields.book_price),
			premiumTwap: BigInt(fields.premium_twap),
			premiumTwapLastUpdateMs: Number(fields.premium_twap_last_upd_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static updatedSpreadTwapEventFromOnChain = (
		eventOnChain: UpdatedSpreadTwapEventOnChain
	): UpdatedSpreadTwapEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			marketId: Helpers.addLeadingZeroesToType(fields.ch_id),
			bookPrice: BigInt(fields.book_price),
			indexPrice: BigInt(fields.index_price),
			spreadTwap: BigInt(fields.spread_twap),
			spreadTwapLastUpdateMs: Number(fields.spread_twap_last_upd_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}
