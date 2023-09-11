import {
	Balance,
	CoinType,
	RouterSerializablePool,
	ObjectId,
} from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export type CetusPoolObject = CetusPoolSimpleInfo & {
	coinABalance: Balance;
	coinBBalance: Balance;
	isPaused: boolean;
};

export interface CetusPoolSimpleInfo {
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
