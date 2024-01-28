import { ObjectId } from "../../../../../types";
import { RouterSynchronousSerializablePool } from "../../../routerTypes";

// =========================================================================
//  Interface
// =========================================================================

export interface RouterSynchronousApiInterface<
	PoolType extends RouterSynchronousSerializablePool
> {
	// =========================================================================
	//  Required Functions
	// =========================================================================

	fetchAllPools: () => Promise<PoolType[]>;
}
