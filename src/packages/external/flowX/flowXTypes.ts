import { CoinType, Object, RouterSerializablePool } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface FlowXPoolObject extends Object {
	// this is purely for pool object classification
	dummyField: "FlowX";
	coinTypeX: CoinType;
	coinTypeY: CoinType;
}

export const isFlowXPoolObject = (
	pool: RouterSerializablePool
): pool is FlowXPoolObject => {
	return (
		"coinTypeX" in pool &&
		"coinTypeY" in pool &&
		"dummyField" in pool &&
		pool.dummyField === "FlowX"
	);
};
