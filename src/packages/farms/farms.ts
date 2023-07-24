import { SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsCreateStakingPoolBody,
	ApiFarmsOwnedStakedPositionsBody,
	ApiFarmsOwnedStakingPoolOwnerCapsBody,
	FarmsStakedPositionObject,
	FarmsStakingPoolObject,
	StakingPoolOwnerCapObject,
} from "./farmsTypes";
import { ObjectId } from "@mysten/sui.js";
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
		const stakingPool = await this.fetchApi<FarmsStakingPoolObject>(
			inputs.objectId
		);
		return new FarmsStakingPool(stakingPool, this.network);
	}

	public async getStakingPools(inputs: { objectIds: ObjectId[] }) {
		return Promise.all(
			inputs.objectIds.map((objectId) =>
				this.getStakingPool({ objectId })
			)
		);
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
		>("owned-staked-positions", inputs);
		return positions.map(
			(pool) => new FarmsStakedPosition(pool, this.network)
		);
	}

	public async getOwnedStakingPoolOwnerCaps(
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	) {
		return this.fetchApi<
			StakingPoolOwnerCapObject[],
			ApiFarmsOwnedStakingPoolOwnerCapsBody
		>("owned-staking-pool-owner-caps", inputs);
	}

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
