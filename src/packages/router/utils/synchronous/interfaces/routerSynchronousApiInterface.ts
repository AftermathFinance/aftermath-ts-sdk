import { ObjectId } from "@mysten/sui.js";
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

	fetchAllPoolIds: () => Promise<ObjectId[]>;

	fetchPoolsFromIds: (inputs: {
		objectIds: ObjectId[];
	}) => Promise<PoolType[]>;
}
