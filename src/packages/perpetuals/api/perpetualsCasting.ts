import { TypeName } from "@mysten/bcs";
import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectType,
	SuiRawMoveObject,
} from "@mysten/sui.js";
import {
	AccountManager,
	MarketManager,
	MarketState,
	Orderbook,
	Order,
	OrderedMap,
	Branch,
	Leaf,
	OrderedVecSet,
	MarketParams,
	Account,
	Position,
	bcs,
} from "../perpetualsTypes";

export class PerpetualsCasting {
	// =========================================================================
	//  Account Manager
	// =========================================================================

	public static accountManagerFromSuiResponse = (
		data: SuiObjectResponse
	): AccountManager => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return PerpetualsCasting.castObjectBcs({
			resp: data,
			typeName: "AccountManager",
			fromDeserialized: PerpetualsCasting.accountManagerFromRaw,
		});
	};

	public static accountManagerFromRaw(data: any): AccountManager {
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
	): Account => {
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

	public static accountFromRaw = (data: any): Account => {
		return {
			collateral: BigInt(data.collateral),
			marketIds: data.marketIds.map((id: number) => BigInt(id)),
			positions: data.positions.map((pos: any) =>
				PerpetualsCasting.positionFromRaw(pos)
			),
		};
	};

	public static positionFromRaw = (data: any): Position => {
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

	public static orderedVecSetFromRaw(data: any): OrderedVecSet {
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
	): MarketManager => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return PerpetualsCasting.castObjectBcs({
			resp: data,
			typeName: "MarketManager",
			fromDeserialized: PerpetualsCasting.marketManagerFromRaw,
		});
	};

	public static marketManagerFromRaw(data: any): MarketManager {
		return {
			objectId: data.id,
			objectType: data.objectType,
			feesAccrued: BigInt(data.feesAccrued),
			minOrderUsdValue: BigInt(data.minOrderUsdValue),
			liquidationTolerance: BigInt(data.liquidationTolerance),
		};
	}

	public static marketParamsFromRaw = (data: any): MarketParams => {
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

	public static marketStateFromRaw = (data: any): MarketState => {
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

	public static orderbookFromRaw = (data: any): Orderbook => {
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

	public static orderedMapFromRaw<T>(data: any): OrderedMap<T> {
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

	// =========================================================================
	//  General
	// =========================================================================

	public static castObjectBcs = <T>(inputs: {
		resp: SuiObjectResponse;
		typeName: TypeName;
		fromDeserialized: (deserialized: any) => T;
	}): T => {
		const { resp, typeName, fromDeserialized } = inputs;
		const rawObj = resp.data?.bcs as SuiRawMoveObject;
		const deserialized = bcs.de(typeName, rawObj.bcsBytes, "base64");
		return fromDeserialized(deserialized);
	};
}
