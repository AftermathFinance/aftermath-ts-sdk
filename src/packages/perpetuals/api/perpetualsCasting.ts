import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectType,
} from "@mysten/sui.js";
import {
	PerpetualsAccountManager,
	PerpetualsMarketManager,
	PerpetualsMarketState,
	PerpetualsOrderbook,
	Order,
	PerpetualsOrderedMap,
	PerpetualsOrderedVecSet,
	PerpetualsMarketParams,
	PerpetualsAccountObject,
	PerpetualsPosition,
	bcs,
} from "../perpetualsTypes";
import { Casting } from "../../../general/utils";

export class PerpetualsCasting {
	// =========================================================================
	//  Account Manager
	// =========================================================================

	public static accountManagerFromSuiResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountManager => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return Casting.castObjectBcs({
			suiObjectResponse: data,
			typeName: "AccountManager",
			fromDeserialized: PerpetualsCasting.accountManagerFromRaw,
			bcs,
		});
	};

	public static accountManagerFromRaw(data: any): PerpetualsAccountManager {
		return {
			objectId: data.id,
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
		const objectFields = getObjectFields(data) as ObjectContentFields;
		const value = objectFields.value.fields;
		return {
			collateral: value.collateral,
			marketIds: value.market_ids.map((id: any) => BigInt(id)),
			positions: value.positions.map((pos: any) =>
				PerpetualsCasting.positionFromRaw(pos)
			),
		};
	};

	public static accountFromRaw = (data: any): PerpetualsAccountObject => {
		return {
			collateral: BigInt(data.collateral),
			marketIds: data.marketIds.map((id: number) => BigInt(id)),
			positions: data.positions.map((pos: any) =>
				PerpetualsCasting.positionFromRaw(pos)
			),
		};
	};

	public static positionFromRaw = (data: any): PerpetualsPosition => {
		return {
			baseAssetAmount: BigInt(data.baseAssetAmount),
			quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			asks: PerpetualsCasting.orderedVecSetFromRaw(data.asks),
			bids: PerpetualsCasting.orderedVecSetFromRaw(data.bids),
			asksQuantity: BigInt(data.asksQuantity),
			bidsQuantity: BigInt(data.bidsQuantity),
		};
	};

	public static orderedVecSetFromRaw(data: any): PerpetualsOrderedVecSet {
		return {
			objectId: data.id,
			objectType: data.objectType,
		};
	}

	public static contentsFromRaw<T>(): (v: any) => T {
		return (v: any) => v;
	}

	// =========================================================================
	//  Market Manager
	// =========================================================================

	public static marketManagerFromSuiResponse = (
		data: SuiObjectResponse
	): PerpetualsMarketManager => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return Casting.castObjectBcs({
			suiObjectResponse: data,
			typeName: "MarketManager",
			fromDeserialized: PerpetualsCasting.marketManagerFromRaw,
			bcs,
		});
	};

	public static marketManagerFromRaw(data: any): PerpetualsMarketManager {
		return {
			objectId: data.id,
			objectType: data.objectType,
			feesAccrued: BigInt(data.feesAccrued),
			minOrderUsdValue: BigInt(data.minOrderUsdValue),
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
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return {
			objectType,
			objectId: data.id.id,
			lotSize: BigInt(data.lot_size),
			tickSize: BigInt(data.tick_size),
			asks: PerpetualsCasting.orderedMapFromRaw<Order>(data.asks),
			bids: PerpetualsCasting.orderedMapFromRaw<Order>(data.bids),
			counter: BigInt(data.counter),
		};
	};

	public static orderedMapFromRaw<T>(data: any): PerpetualsOrderedMap<T> {
		return {
			objectId: data.id,
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

	public static orderFromRaw = (data: any): Order => {
		return {
			accountId: BigInt(data.accountId),
			size: BigInt(data.size),
		};
	};
}
