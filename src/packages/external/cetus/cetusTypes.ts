import { ObjectId } from "@mysten/sui.js";
import { Balance, CoinType, RouterSerializablePool } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface CetusRouterPoolObject {
	poolObjectId: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
	spotPriceAOverB: number;
	curve: {
		slope: number;
		intercept: bigint;
	};
}

export interface CetusPoolObject {
	poolObjectId: ObjectId;
	// poolKeyId: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
}

export interface CetusCalcTradeResult {
	amountIn: Balance;
	amountOut: Balance;
	feeAmount: Balance;
	feeRate: bigint;
}

export const isCetusRouterPoolObject = (
	pool: RouterSerializablePool
): pool is CetusRouterPoolObject => {
	return (
		"poolObjectId" in pool &&
		"coinTypeA" in pool &&
		"coinTypeB" in pool &&
		"spotPriceAOverB" in pool &&
		"curve" in pool
	);
};
