import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface DeepBookPoolObject {
	objectId: ObjectId;
	baseCoin: CoinType;
	quoteCoin: CoinType;
}
