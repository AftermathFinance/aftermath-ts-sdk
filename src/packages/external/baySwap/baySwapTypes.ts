import { CoinType } from "../../coin/coinTypes";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	Object,
	RouterSerializablePool,
} from "../../../types";
import { SupplyOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface BaySwapPoolObject extends Object {
	coinXReserveValue: Balance;
	coinYReserveValue: Balance;
	lpTokenSupplyValue: Balance;
	feePercent: bigint;
	daoFeePercent: bigint;
	isLocked: boolean;
	xScale: bigint;
	yScale: bigint;
	coinTypeX: CoinType;
	coinTypeY: CoinType;
	curveType: AnyObjectType;
	isStable: boolean;
}

export const isBaySwapPoolObject = (
	pool: RouterSerializablePool
): pool is BaySwapPoolObject => {
	return (
		"coinXReserveValue" in pool &&
		"lpTokenSupplyValue" in pool &&
		"feePercent" in pool &&
		"daoFeePercent" in pool &&
		"isLocked" in pool &&
		"xScale" in pool &&
		"coinTypeX" in pool &&
		"curveType" in pool &&
		"isStable" in pool
	);
};

// =========================================================================
//  On-Chain
// =========================================================================

export interface BaySwapPoolFieldsOnChain {
	coin_x_reserve: BigIntAsString;
	coin_y_reserve: BigIntAsString;
	lp_token_supply: SupplyOnChain;
	fee_percent: BigIntAsString;
	dao_fee_percent: BigIntAsString;
	is_locked: boolean;
	x_scale: BigIntAsString;
	y_scale: BigIntAsString;
}
