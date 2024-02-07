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

	fetchAllPools: (isRouter?: true) => Promise<PoolType[]>;
}
