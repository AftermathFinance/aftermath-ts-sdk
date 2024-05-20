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
	PerpetualsMarketId,
} from "../perpetualsTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Coin, Perpetuals } from "../..";
import { CoinSymbol, CoinType } from "../../coin/coinTypes";
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
	PerpetualsMarketParamsFieldsIndexerReponse,
	PerpetualsMarketStateFieldsIndexerReponse,
	PerpetualsAccountPositionsIndexerResponse,
	PerpetualsPositionIndexerResponse,
	PerpetualsMarketDataIndexerResponse,
} from "../perpetualsCastingTypes";
import { BigIntAsString, ObjectDigest, ObjectVersion } from "../../../types";
import { bcs } from "@mysten/sui.js/bcs";

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
		collateralCoinType: CoinType,
		version: ObjectVersion,
		digest: ObjectDigest
	): PerpetualsRawAccountCap {
		return {
			collateralCoinType,
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType, // use Helpers.addLeadingZeroesToType ?
			objectVersion: version,
			objectDigest: digest,
			accountId: BigInt(data.accountId),
			collateral: BigInt(data.collateral.value),
		};
	}

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

	public static positionFromIndexerReponse = (inputs: {
		position: PerpetualsPositionIndexerResponse;
		collateralCoinType: CoinType;
		marketId: PerpetualsMarketId;
	}): PerpetualsPosition => {
		const { position, collateralCoinType, marketId } = inputs;
		return {
			collateralCoinType,
			collateral: Casting.IFixed.iFixedFromStringBytes(
				position.position.collateral
			),
			baseAssetAmount: Casting.IFixed.iFixedFromStringBytes(
				position.position.base_asset_amount
			),
			quoteAssetNotionalAmount: Casting.IFixed.iFixedFromStringBytes(
				position.position.quote_asset_notional_amount
			),
			cumFundingRateLong: Casting.IFixed.iFixedFromStringBytes(
				position.position.cum_funding_rate_long
			),
			cumFundingRateShort: Casting.IFixed.iFixedFromStringBytes(
				position.position.cum_funding_rate_short
			),
			asksQuantity: Casting.IFixed.iFixedFromStringBytes(
				position.position.asks_quantity
			),
			bidsQuantity: Casting.IFixed.iFixedFromStringBytes(
				position.position.bids_quantity
			),
			marketId: Helpers.addLeadingZeroesToType(marketId),
			// NOTE: do we want to store all pending order data here as well ?
			pendingOrders: [
				...Object.entries(position.pending_orders.bids).map(
					([orderId, size]) => ({
						size: BigInt(size),
						orderId: BigInt(orderId),
						side: PerpetualsOrderSide.Bid,
					})
				),
				...Object.entries(position.pending_orders.asks).map(
					([orderId, size]) => ({
						size: BigInt(size),
						orderId: BigInt(orderId),
						side: PerpetualsOrderSide.Ask,
					})
				),
			],
			makerFee: Casting.IFixed.iFixedFromStringBytes(
				position.position.maker_fee
			),
			takerFee: Casting.IFixed.iFixedFromStringBytes(
				position.position.taker_fee
			),
		};
	};

	public static accountObjectFromIndexerResponse = (
		response: PerpetualsAccountPositionsIndexerResponse,
		collateralCoinType: CoinType
	): PerpetualsAccountObject => {
		return {
			positions: response.map(([marketIdAsStringBytes, position]) =>
				this.positionFromIndexerReponse({
					position,
					collateralCoinType,
					marketId: Casting.addressFromStringBytes(
						marketIdAsStringBytes
					),
				})
			),
		};
	};

	// =========================================================================
	//  Clearing House
	// =========================================================================

	public static marketDataFromIndexerResponse(
		data: PerpetualsMarketDataIndexerResponse,
		collateralCoinType: CoinType,
		baseAssetSymbol: CoinSymbol
	): PerpetualsMarketData {
		return {
			objectId: Casting.addressFromStringBytes(data.id.id),
			initialSharedVersion: Number(data.initial_shared_version),
			collateralCoinType,
			marketParams: this.marketParamsFromIndexerResponse(
				data.market_params,
				baseAssetSymbol
			),
			marketState: this.marketStateFromIndexerResponse(data.market_state),
		};
	}

	private static marketParamsFromIndexerResponse = (
		data: PerpetualsMarketParamsFieldsIndexerReponse,
		baseAssetSymbol: CoinSymbol
	): PerpetualsMarketParams => {
		return {
			baseAssetSymbol,
			basePriceFeedId: Casting.addressFromStringBytes(data.base_pfs_id),
			collateralPriceFeedId: Casting.addressFromStringBytes(
				data.collateral_pfs_id
			),
			marginRatioInitial: Casting.IFixed.iFixedFromStringBytes(
				data.margin_ratio_initial
			),
			marginRatioMaintenance: Casting.IFixed.iFixedFromStringBytes(
				data.margin_ratio_maintenance
			),
			fundingFrequencyMs: BigInt(data.funding_frequency_ms),
			fundingPeriodMs: BigInt(data.funding_period_ms),
			premiumTwapFrequencyMs: BigInt(data.premium_twap_frequency_ms),
			premiumTwapPeriodMs: BigInt(data.premium_twap_period_ms),
			spreadTwapFrequencyMs: BigInt(data.spread_twap_frequency_ms),
			spreadTwapPeriodMs: BigInt(data.spread_twap_period_ms),
			makerFee: Casting.IFixed.iFixedFromStringBytes(data.maker_fee),
			takerFee: Casting.IFixed.iFixedFromStringBytes(data.taker_fee),
			liquidationFee: Casting.IFixed.iFixedFromStringBytes(
				data.liquidation_fee
			),
			forceCancelFee: Casting.IFixed.iFixedFromStringBytes(
				data.force_cancel_fee
			),
			insuranceFundFee: Casting.IFixed.iFixedFromStringBytes(
				data.insurance_fund_fee
			),
			lotSize: BigInt(data.lot_size),
			tickSize: BigInt(data.tick_size),
			liquidationTolerance: BigInt(data.liquidation_tolerance),
			maxPendingOrders: BigInt(data.max_pending_orders),
			minOrderUsdValue: Casting.IFixed.iFixedFromStringBytes(
				data.min_order_usd_value
			),
			oracleTolerance: BigInt(data.oracle_tolerance),
		};
	};

	private static marketStateFromIndexerResponse = (
		data: PerpetualsMarketStateFieldsIndexerReponse
	): PerpetualsMarketState => {
		return {
			cumFundingRateLong: Casting.IFixed.iFixedFromStringBytes(
				data.cum_funding_rate_long
			),
			cumFundingRateShort: Casting.IFixed.iFixedFromStringBytes(
				data.cum_funding_rate_short
			),
			fundingLastUpdMs: Number(data.funding_last_upd_ms),
			premiumTwap: Casting.IFixed.iFixedFromStringBytes(
				data.premium_twap
			),
			premiumTwapLastUpdMs: Number(data.premium_twap_last_upd_ms),
			spreadTwap: Casting.IFixed.iFixedFromStringBytes(data.spread_twap),
			spreadTwapLastUpdMs: Number(data.spread_twap_last_upd_ms),
			openInterest: Casting.IFixed.iFixedFromStringBytes(
				data.open_interest
			),
			feesAccrued: Casting.IFixed.iFixedFromStringBytes(
				data.fees_accrued
			),
		};
	};

	// =========================================================================
	//  Orderbook
	// =========================================================================

	public static orderbookPriceFromBytes = (bytes: number[]): number => {
		const unwrapped: BigIntAsString | undefined =
			Casting.unwrapDeserializedOption(
				bcs.de("Option<u256>", new Uint8Array(bytes))
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
		return {
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
		return {
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
		return {
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
		return {
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
		return {
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
		return {
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
		return {
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
		return {
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
		return {
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
		return {
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
		const baseAssetDelta = Casting.IFixed.iFixedFromNumber(
			Casting.IFixed.numberFromIFixed(
				BigInt(fields.base_asset_delta_bid)
			) -
				Casting.IFixed.numberFromIFixed(
					BigInt(fields.base_asset_delta_ask)
				)
		);
		return {
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
			liquidatedVolume: BigInt(fields.liquidated_volume),
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
		return {
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
		return {
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
