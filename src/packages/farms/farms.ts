import { SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsCreateStakingPoolBody,
	ApiFarmsOwnedStakedPositionsBody,
	FarmsStakedPositionObject,
	FarmsStakingPoolObject,
} from "./farmsTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { FarmsStakingPool } from "./farmsStakingPool";
import { FarmsStakedPosition } from "./farmsStakedPosition";

export class Farms extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "farms");
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getStakingPool(inputs: { objectId: ObjectId }) {
		const stkaingPool = await this.fetchApi<FarmsStakingPoolObject>(
			inputs.objectId
		);
		return new FarmsStakingPool(stkaingPool, this.network);
	}

	public async getAllStakingPools() {
		const stakingPools = await this.fetchApi<FarmsStakingPoolObject[]>("");
		return stakingPools.map(
			(pool) => new FarmsStakingPool(pool, this.network)
		);
	}

	public async getOwnedStakedPositions(
		inputs: ApiFarmsOwnedStakedPositionsBody
	) {
		const positions = await this.fetchApi<
			FarmsStakedPositionObject[],
			ApiFarmsOwnedStakedPositionsBody
		>("farms/staked-positions/owned", inputs);
		return positions.map(
			(pool) => new FarmsStakedPosition(pool, this.network)
		);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateStakingPoolTransaction(
		inputs: ApiFarmsCreateStakingPoolBody
	) {
		return this.fetchApiTransaction<ApiFarmsCreateStakingPoolBody>(
			"transactions/create-staking-pool",
			inputs
		);
	}
}
