import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	PerpetualsAccountManager,
	PerpetualsMarketManager,
	PerpetualsMarketState,
	PerpetualsOrderbook,
	PerpetualsOrder,
	PerpetualsOrderedMap,
	OrderedVecSet,
	PerpetualsMarketParams,
	PerpetualsAccountObject,
	PerpetualsPosition,
	bcs,
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
	LiquidatedEvent,
	SettledFundingEvent,
	AcquiredLiqeeEvent,
	PerpetualsFillReceipt,
} from "../perpetualsTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../..";
import { CoinType } from "../../coin/coinTypes";
import { FixedUtils } from "../../../general/utils/fixedUtils";
import {
	CanceledOrderEventOnChain,
	CreatedAccountEventOnChain,
	DepositedCollateralEventOnChain,
	PostedOrderEventOnChain,
	WithdrewCollateralEventOnChain,
	BidOnChain,
	AskOnChain,
	FilledMakerOrderEventOnChain,
	FilledTakerOrderEventOnChain,
	LiquidatedEventOnChain,
	SettledFundingEventOnChain,
	AcquiredLiqeeEventOnChain,
} from "../perpetualsCastingTypes";
import { BigIntAsString } from "../../../types";

// TODO: handle 0xs and leading 0s everywhere
export class PerpetualsApiCasting {
	// =========================================================================
	//  Account Manager
	// =========================================================================

	public static accountManagerFromSuiResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountManager => {
		return Casting.castObjectBcs({
			suiObjectResponse: data,
			typeName: "AccountManager",
			fromDeserialized: this.accountManagerFromRaw,
			bcs,
		});
	};

	public static accountManagerFromRaw(data: any): PerpetualsAccountManager {
		return {
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
			maxPositionsPerAccount: BigInt(data.maxPositionsPerAccount),
			maxPendingOrdersPerPosition: BigInt(
				data.maxPendingOrdersPerPosition
			),
			nextAccountId: BigInt(data.nextAccountId),
		};
	}

	public static accountFromSuiResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountObject => {
		const objectFields = Helpers.getObjectFields(data);
		const value = objectFields.value.fields;
		return {
			collateral: BigInt(value.collateral),
			positions: (value.positions as any[]).map((pos: any, index) => ({
				...this.partialPositionFromRaw(pos),
				marketId: BigInt(value.marketIds[index]),
			})),
		};
	};

	public static accountFromRaw = (data: any): PerpetualsAccountObject => {
		return {
			collateral: BigInt(data.collateral),
			positions: (data.positions as any[]).map((pos: any, index) => ({
				...this.partialPositionFromRaw(pos),
				marketId: BigInt(data.marketIds[index]),
			})),
		};
	};

	public static partialPositionFromRaw = (
		data: any
	): Omit<PerpetualsPosition, "marketId"> => {
		return {
			baseAssetAmount: BigInt(data.baseAssetAmount),
			quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			asks: this.orderedVecSetFromRaw(data.asks),
			bids: this.orderedVecSetFromRaw(data.bids),
			asksQuantity: BigInt(data.asksQuantity),
			bidsQuantity: BigInt(data.bidsQuantity),
		};
	};

	public static orderedVecSetFromRaw(data: any): OrderedVecSet {
		return {
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
		};
	}

	public static contentsFromRaw<T>(): (v: any) => T {
		return (v: any) => v;
	}

	public static accountCapFromSuiResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountCap => {
		return Casting.castObjectBcs({
			suiObjectResponse: data,
			typeName: "AccountCap",
			fromDeserialized: this.accountCapFromRaw,
			bcs,
		});
	};

	public static accountCapFromRaw(data: any): PerpetualsAccountCap {
		const coinType = Helpers.addLeadingZeroesToType(
			Coin.getInnerCoinType(data.objectType)
		);
		return {
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
			accountId: BigInt(data.accountId),
			collateralCoinType: coinType,
		};
	}

	public static accountCapWithTypeFromRaw(
		data: any,
		coinType: CoinType
	): PerpetualsAccountCap {
		return {
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
			accountId: BigInt(data.accountId),
			collateralCoinType: coinType,
		};
	}
	// =========================================================================
	//  Market Manager
	// =========================================================================

	public static marketManagerFromSuiResponse = (
		data: SuiObjectResponse
	): PerpetualsMarketManager => {
		return Casting.castObjectBcs({
			suiObjectResponse: data,
			typeName: "MarketManager",
			fromDeserialized: this.marketManagerFromRaw,
			bcs,
		});
	};

	public static marketManagerFromRaw(data: any): PerpetualsMarketManager {
		return {
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
			feesAccrued: BigInt(data.feesAccrued),
			liquidationTolerance: BigInt(data.liquidationTolerance),
		};
	}

	public static marketParamsFromRaw = (data: any): PerpetualsMarketParams => {
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
			insuranceFundId: BigInt(data.insuranceFundId),
			minOrderUsdValue: BigInt(data.minOrderUsdValue),
		};
	};

	public static marketStateFromRaw = (data: any): PerpetualsMarketState => {
		return {
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			fundingLastUpdMs: Number(data.fundingLastUpdMs),
			premiumTwap: BigInt(data.premiumTwap),
			premiumTwapLastUpdMs: Number(data.premiumTwapLastUpdMs),
			spreadTwap: BigInt(data.spreadTwap),
			spreadTwapLastUpdMs: Number(data.spreadTwapLastUpdMs),
			openInterest: BigInt(data.openInterest),
		};
	};

	public static orderbookFromRaw = (data: any): PerpetualsOrderbook => {
		return {
			objectType: data.objectType,
			objectId: Helpers.addLeadingZeroesToType(data.id),
			lotSize: BigInt(data.lotSize),
			tickSize: BigInt(data.tickSize),
			asks: this.orderedMapFromRaw<PerpetualsOrder>(data.asks),
			bids: this.orderedMapFromRaw<PerpetualsOrder>(data.bids),
			counter: BigInt(data.counter),
		};
	};

	public static orderedMapFromRaw<T>(data: any): PerpetualsOrderedMap<T> {
		return {
			objectId: Helpers.addLeadingZeroesToType(data.id),
			objectType: data.objectType,
			size: BigInt(data.size),
			counter: BigInt(data.counter),
			root: BigInt(data.root),
			first: BigInt(data.first),
			branchMin: BigInt(data.branchMin),
			branchMax: BigInt(data.branchMax),
			leafMin: BigInt(data.leafMin),
			leafMax: BigInt(data.leafMax),
			branchesMergeMax: BigInt(data.branchesMergeMax),
			leavesMergeMax: BigInt(data.leavesMergeMax),
		};
	}

	public static partialOrderFromRaw = (
		data: any
	): Omit<PerpetualsOrder, "side"> => {
		return {
			accountId: BigInt(data.accountId),
			size: BigInt(data.size),
		};
	};

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

	public static fillReceiptFromRaw = (data: any): PerpetualsFillReceipt => {
		return {
			accountId: BigInt(data.accountId),
			orderId: BigInt(data.orderId),
			size: BigInt(data.size),
			dropped: data.dropped,
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
			collateral: BigInt(fields.collateral),
			collateralDelta: BigInt(0),
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
			collateral: BigInt(fields.collateral),
			collateralDelta: BigInt(0),
			vault: Helpers.addLeadingZeroesToType(fields.vault),
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
			collateral: BigInt(fields.collateral),
			collateralDelta: BigInt(0),
			marketIds: fields.market_ids.map((marketId) => BigInt(marketId)),
			posFundingRatesLong: fields.pos_funding_rates_long.map((rate) =>
				BigInt(rate)
			),
			posFundingRatesShort: fields.pos_funding_rates_short.map((rate) =>
				BigInt(rate)
			),
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
			collateral: BigInt(fields.liqee_collateral),
			collateralDelta: BigInt(0),
			liqorAccountId: BigInt(fields.liqor_account_id),
			liqorCollateral: BigInt(fields.liqor_collateral),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static acquiredLiqeeEventFromOnChain = (
		eventOnChain: AcquiredLiqeeEventOnChain
	): AcquiredLiqeeEvent => {
		const fields = eventOnChain.parsedJson;
		const collateralCoinType = Helpers.addLeadingZeroesToType(
			new Coin(eventOnChain.type).innerCoinType
		);
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			marketId: BigInt(fields.market_id),
			baseAssetAmount: BigInt(fields.base_asset_amount),
			quoteAssetNotionalAmount: BigInt(
				fields.quote_asset_notional_amount
			),
			size: BigInt(fields.size_to_acquire),
			markPrice: BigInt(fields.mark_price),
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
			user: Helpers.addLeadingZeroesToType(fields.user),
			accountId: BigInt(fields.account_id),
			collateralCoinType,
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
			accountId: BigInt(fields.account_id),
			marketId: BigInt(fields.market_id),
			side:
				fields.side === AskOnChain
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			size: BigInt(fields.size),
			orderId: BigInt(fields.order_id),
			asksQuantity: BigInt(fields.asks_quantity),
			bidsQuantity: BigInt(fields.bids_quantity),
			collateralCoinType,
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
			accountId: BigInt(fields.account_id),
			marketId: BigInt(fields.market_id),
			orderId: BigInt(fields.order_id),
			side:
				fields.side === AskOnChain
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			size: BigInt(fields.size),
			asksQuantity: BigInt(fields.asks_quantity),
			bidsQuantity: BigInt(fields.bids_quantity),
			collateralCoinType,
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
			accountId: BigInt(fields.account_id),
			collateral: BigInt(fields.collateral),
			collateralDelta: BigInt(0),
			marketId: BigInt(fields.market_id),
			orderId: BigInt(fields.order_id),
			// TODO: move to helper func ?
			side:
				fields.side === AskOnChain
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			size: BigInt(fields.size),
			dropped: fields.dropped,
			baseAssetAmount: BigInt(fields.base_asset_amount),
			quoteAssetNotionalAmount: BigInt(
				fields.quote_asset_notional_amount
			),
			asksQuantity: BigInt(fields.asks_quantity),
			bidsQuantity: BigInt(fields.bids_quantity),
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
		return {
			collateralCoinType,
			accountId: BigInt(fields.account_id),
			collateral: BigInt(fields.collateral),
			collateralDelta: BigInt(0),
			marketId: BigInt(fields.market_id),
			baseAssetAmount: BigInt(fields.base_asset_amount),
			quoteAssetNotionalAmount: BigInt(
				fields.quote_asset_notional_amount
			),
			side:
				fields.side === AskOnChain
					? PerpetualsOrderSide.Ask
					: PerpetualsOrderSide.Bid,
			baseAssetDelta: BigInt(fields.base_asset_delta),
			quoteAssetDelta: BigInt(fields.quote_asset_delta),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}
