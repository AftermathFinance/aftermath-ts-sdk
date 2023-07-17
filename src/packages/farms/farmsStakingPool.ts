import { SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import { FarmsStakingPoolObject } from "./farmsTypes";

export class FarmsStakingPool extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly stakingPool: FarmsStakingPoolObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `farms/staking-pools/${stakingPool.objectId}`);
		this.stakingPool = stakingPool;
	}
}
