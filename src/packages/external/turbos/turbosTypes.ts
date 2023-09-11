import {
	Balance,
	CoinType,
	ObjectId,
	RouterSerializablePool,
} from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export type TurbosPoolObject = TurbosPartialPoolObject & {
	sqrtPrice: bigint;
	coinABalance: Balance;
	coinBBalance: Balance;
	isUnlocked: boolean;
};

export interface TurbosPartialPoolObject {
	id: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
	fee: bigint;
	feeCoinType: CoinType;
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
