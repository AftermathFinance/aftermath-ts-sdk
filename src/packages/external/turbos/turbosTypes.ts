import { ObjectId } from "@mysten/sui.js";
import { Balance, CoinType, RouterSerializablePool } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface TurbosPoolObject {
	id: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
	fee: bigint;
	feeCoinType: CoinType;
	sqrtPrice: bigint;
}

export interface TurbosCalcTradeResult {
	amountIn: Balance;
	amountOut: Balance;
	feeAmount: Balance;
	protocolFee: bigint;
}

export const isTurbosPoolObject = (
	pool: RouterSerializablePool
): pool is TurbosPoolObject => {
	return (
		"id" in pool &&
		"coinTypeA" in pool &&
		"coinTypeB" in pool &&
		"fee" in pool &&
		"feeCoinType" in pool &&
		"sqrtPrice" in pool
	);
};
