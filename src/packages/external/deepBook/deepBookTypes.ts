import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";

export interface DeepBookPoolObject {
	objectId: ObjectId;
	baseCoin: CoinType;
	quoteCoin: CoinType;
}
