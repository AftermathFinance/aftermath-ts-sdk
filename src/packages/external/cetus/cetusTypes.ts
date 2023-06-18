import { ObjectId } from "@mysten/sui.js";
import { Balance, CoinType, RouterSerializablePool } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface CetusPoolObject {
	id: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
}

export interface CetusCalcTradeResult {
	amountIn: Balance;
	amountOut: Balance;
	feeAmount: Balance;
	feeRate: bigint;
}

export const isCetusPoolObject = (
	pool: RouterSerializablePool
): pool is CetusPoolObject => {
	return "id" in pool && "coinTypeA" in pool && "coinTypeB" in pool;
};
