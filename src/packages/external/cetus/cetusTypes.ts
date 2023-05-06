import { ObjectId } from "@mysten/sui.js";
import { Balance, CoinType } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface CetusPoolSimpleInfo {
	poolObjectId: ObjectId;
	poolKeyId: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
}

export interface CetusCalcTradeResult {
	amountIn: Balance;
	amountOut: Balance;
	feeAmount: Balance;
	feeRate: bigint;
}
