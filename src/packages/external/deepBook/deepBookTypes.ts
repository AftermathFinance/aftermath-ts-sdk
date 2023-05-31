import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Balance, RouterSerializablePool } from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface PartialDeepBookPoolObject {
	objectId: ObjectId;
	baseCoinType: CoinType;
	quoteCoinType: CoinType;
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
	pool: RouterSerializablePool
): pool is DeepBookPoolObject => {
	return (
		"bids" in pool &&
		"asks" in pool &&
		"baseCoinType" in pool &&
		"quoteCoinType" in pool
	);
};
