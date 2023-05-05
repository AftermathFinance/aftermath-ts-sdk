import { ObjectId } from "@mysten/sui.js";
import { AnyObjectType, CoinType } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface CetusPoolSimpleInfo {
	poolObjectId: ObjectId;
	poolKeyId: ObjectId;
	coinTypeA: CoinType;
	coinTypeB: CoinType;
}
