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
} from "../perpetualsTypes";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../..";
import { CoinType } from "../../coin/coinTypes";
import { FixedUtils } from "../../../general/utils/fixedUtils";

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
		const unwrapped: bigint | undefined = Casting.unwrapDeserializedOption(
			bcs.de("Option<u256>", new Uint8Array(bytes))
		);
		return FixedUtils.directCast(unwrapped ?? BigInt(0));
	};
}
