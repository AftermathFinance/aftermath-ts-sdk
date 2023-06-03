import { SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import { FarmsStakingPoolObject } from "./farmsTypes";

export class FarmsStakingPool extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {};

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
