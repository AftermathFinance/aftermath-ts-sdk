import { ObjectId } from "@mysten/sui.js";
import { Balance, CoinType, RouterSerializablePool } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface CetusRouterPoolObject {
	poolObjectId: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
	tradeResults: {
		coinInType: CoinType;
		coinOutType: CoinType;
		amounts: {
			amountIn: Balance;
			amountOut: Balance;
		}[];
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
		"tradeResults" in pool
	);
};
