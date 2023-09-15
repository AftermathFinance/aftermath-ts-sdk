import { CoinDecimal, CoinType } from "../../coin/coinTypes";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	Object,
	RouterSerializablePool,
	ObjectId,
} from "../../../types";
import { SupplyOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface InterestPoolObject extends Object {
	objectType: AnyObjectType;
	kLast: bigint;
	lpCoinSupplyValue: Balance;
	balanceXValue: Balance;
	balanceYValue: Balance;
	decimalsX: bigint;
	decimalsY: bigint;
	isStable: boolean;
	timestampLast: bigint;
	balanceXCumulativeLast: bigint;
	balanceYCumulativeLast: bigint;
	locked: boolean;
	curveType: AnyObjectType;
	coinTypeX: CoinType;
	coinTypeY: CoinType;
}

export const isInterestPoolObject = (
	pool: RouterSerializablePool
): pool is InterestPoolObject => {
	return (
		"kLast" in pool &&
		"lpCoinSupplyValue" in pool &&
		"balanceXValue" in pool &&
		"balanceYValue" in pool &&
		"isStable" in pool &&
		"timestampLast" in pool
	);
};

// =========================================================================
//  On-Chain
// =========================================================================

export interface InterestPoolFieldsOnChain {
	id: ObjectId;
	k_last: BigIntAsString;
	lp_coin_supply: SupplyOnChain;
	balance_x: BigIntAsString;
	balance_y: BigIntAsString;
	decimals_x: BigIntAsString;
	decimals_y: BigIntAsString;
	is_stable: boolean;
	// observations: {
	// 	timestamp: BigIntAsString;
	// 	balance_x_cumulative: BigIntAsString;
	// 	balance_y_cumulative: BigIntAsString;
	// }[];
	timestamp_last: BigIntAsString;
	balance_x_cumulative_last: BigIntAsString;
	balance_y_cumulative_last: BigIntAsString;
	locked: boolean;
}
