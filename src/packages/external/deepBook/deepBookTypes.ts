import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Balance, RouterSynchronousSerializablePool } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface PartialDeepBookPoolObject {
	objectId: ObjectId;
	baseCoin: CoinType;
	quoteCoin: CoinType;
}

export type DeepBookPoolObject = PartialDeepBookPoolObject & {
	bids: DeepBookPriceRange[];
	asks: DeepBookPriceRange[];
};

export interface DeepBookPriceRange {
	price: number;
	depth: Balance;
}

export const isDeepBookPoolObject = (
	pool: RouterSynchronousSerializablePool
): pool is DeepBookPoolObject => {
	return (
		"bids" in pool &&
		"asks" in pool &&
		"baseCoin" in pool &&
		"quoteCoin" in pool
	);
};
