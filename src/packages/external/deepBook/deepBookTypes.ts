import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Balance, RouterSerializablePool } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface PartialDeepBookPoolObject {
	objectId: ObjectId;
	baseCoin: CoinType;
	quoteCoin: CoinType;
}

export type DeepBookPoolObject = PartialDeepBookPoolObject & {
	bids: {
		price: number;
		depth: Balance;
	}[];
	asks: {
		price: number;
		depth: Balance;
	}[];
};

export const isDeepBookPoolObject = (
	pool: RouterSerializablePool
): pool is DeepBookPoolObject => {
	return (
		"bids" in pool &&
		"asks" in pool &&
		"baseCoin" in pool &&
		"quoteCoin" in pool
	);
};
