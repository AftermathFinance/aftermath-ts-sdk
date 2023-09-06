import { EventsInputs, SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsCreateStakingPoolBody,
	ApiFarmsOwnedStakedPositionsBody,
	ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody,
	ApiFarmsOwnedStakingPoolOwnerCapsBody,
	FarmsDepositedPrincipalEvent,
	FarmsHarvestedRewardsEvent,
	FarmsLockedEvent,
	FarmsStakedEvent,
	FarmsStakedPositionObject,
	FarmsStakedRelaxedEvent,
	FarmsStakingPoolObject,
	FarmsUnlockedEvent,
	FarmsWithdrewPrincipalEvent,
	StakingPoolOneTimeAdminCapObject,
	StakingPoolOwnerCapObject,
} from "./farmsTypes";
import { ObjectId } from "@mysten/sui.js";
import { FarmsStakingPool } from "./farmsStakingPool";
import { FarmsStakedPosition } from "./farmsStakedPosition";

export class Farms extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		minimalRewardsToClaim: BigInt(10),
	};

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
			(pool) => new FarmsStakedPosition(pool, undefined, this.network)
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

	public async getOwnedStakingPoolOneTimeAdminCaps(
		inputs: ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody
	) {
		return this.fetchApi<
			StakingPoolOneTimeAdminCapObject[],
			ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody
		>("owned-staking-pool-one-time-admin-caps", inputs);
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

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Staking Position Creation
	// =========================================================================

	public async getStakedEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsStakedEvent>("events/staked", inputs);
	}

	public async getStakedRelaxedEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsStakedRelaxedEvent>(
			"events/staked-relaxed",
			inputs
		);
	}

	// =========================================================================
	//  Staking Position Locking
	// =========================================================================

	public async getLockedEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsLockedEvent>("events/locked", inputs);
	}

	public async getUnlockedEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsUnlockedEvent>(
			"events/unlocked",
			inputs
		);
	}

	// =========================================================================
	//  Staking Position Staking
	// =========================================================================

	public async getDepositedPrincipalEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsDepositedPrincipalEvent>(
			"events/deposited-principal",
			inputs
		);
	}

	public async getWithdrewPrincipalEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsWithdrewPrincipalEvent>(
			"events/withdrew-principal",
			inputs
		);
	}

	// =========================================================================
	//  Staking Position Reward Harvesting
	// =========================================================================

	public async getHarvestedRewardsEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<FarmsHarvestedRewardsEvent>(
			"events/harvested-rewards",
			inputs
		);
	}
}
