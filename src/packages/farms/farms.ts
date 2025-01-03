import {
	EventsInputs,
	SuiNetwork,
	Url,
	ObjectId,
	CallerConfig,
} from "../../types";
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
import { FarmsStakingPool } from "./farmsStakingPool";
import { FarmsStakedPosition } from "./farmsStakedPosition";
import { AftermathApi } from "../../general/providers";

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

	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "farms");
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getStakingPool(inputs: {
		objectId: ObjectId;
	}): Promise<FarmsStakingPool> {
		const stakingPool = await this.fetchApi<FarmsStakingPoolObject>(
			inputs.objectId
		);
		return new FarmsStakingPool(stakingPool, this.config, this.Provider);
	}

	public async getStakingPools(inputs: {
		objectIds: ObjectId[];
	}): Promise<FarmsStakingPool[]> {
		const stakingPools = await this.fetchApi<
			FarmsStakingPoolObject[],
			{
				objectIds: ObjectId[];
			}
		>("objects", inputs);
		return stakingPools.map(
			(stakingPool) =>
				new FarmsStakingPool(stakingPool, this.config, this.Provider)
		);
	}

	public async getAllStakingPools() {
		const stakingPools = await this.fetchApi<FarmsStakingPoolObject[]>("");
		return stakingPools.map(
			(pool) => new FarmsStakingPool(pool, this.config, this.Provider)
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
			(pool) =>
				new FarmsStakedPosition(
					pool,
					undefined,
					this.config,
					this.Provider
				)
		);
	}

	public async getOwnedStakingPoolOwnerCaps(
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	) {
		// TODO: remove endpoint eventually ?

		// return this.fetchApi<
		// 	StakingPoolOwnerCapObject[],
		// 	ApiFarmsOwnedStakingPoolOwnerCapsBody
		// >("owned-staking-pool-owner-caps", inputs);
		return this.useProvider().fetchOwnedStakingPoolOwnerCaps(inputs);
	}

	public async getOwnedStakingPoolOneTimeAdminCaps(
		inputs: ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody
	) {
		// TODO: remove endpoint eventually ?

		// return this.fetchApi<
		// 	StakingPoolOneTimeAdminCapObject[],
		// 	ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody
		// >("owned-staking-pool-one-time-admin-caps", inputs);
		return this.useProvider().fetchOwnedStakingPoolOneTimeAdminCaps(inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateStakingPoolTransaction(
		inputs: ApiFarmsCreateStakingPoolBody
	) {
		return this.useProvider().fetchBuildCreateStakingPoolTx(inputs);
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

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Farms();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
