import { CoinType } from "../../coin/coinTypes";
import { Balance, Object, RouterSerializablePool } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface PartialDeepBookPoolObject extends Object {
	baseCoinType: CoinType;
	quoteCoinType: CoinType;
	takerFeeRate: number;
	lotSize: bigint;
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
		"quoteCoinType" in pool &&
		"takerFeeRate" in pool &&
		"lotSize" in pool
	);
};
