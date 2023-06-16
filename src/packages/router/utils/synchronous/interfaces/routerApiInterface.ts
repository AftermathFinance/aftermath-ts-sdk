import { CoinType } from "../../../../coin/coinTypes";
import { RouterSerializablePool } from "../../../routerTypes";

// =========================================================================
//  Interface
// =========================================================================

export interface RouterApiInterface<PoolType extends RouterSerializablePool> {
	// =========================================================================
	//  Required
	// =========================================================================

	// =========================================================================
	//  Functions
	// =========================================================================

	fetchAllPools: () => Promise<PoolType[]>;
	fetchSupportedCoins: () => Promise<CoinType[]>;
}
