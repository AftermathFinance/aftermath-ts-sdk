import {
	EventsInputs,
	SuiNetwork,
	Url,
	ObjectId,
	SuiAddress,
	ApiIndexerEventsBody,
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
	FarmUserEvent,
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
		minRewardsToClaim: BigInt(10),
		maxLockMultiplier: 18,
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
				farmIds: ObjectId[];
			}
		>("", {
			farmIds: inputs.objectIds,
		});
		return stakingPools.map(
			(stakingPool) =>
				new FarmsStakingPool(stakingPool, this.config, this.Provider)
		);
	}

	public async getAllStakingPools() {
		const stakingPools: FarmsStakingPoolObject[] = await this.fetchApi(
			"",
			{}
		);
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
	//  Stats
	// =========================================================================

	public async getTVL(inputs?: { farmIds?: ObjectId[] }): Promise<number> {
		return this.fetchApi("tvl", inputs ?? {});
	}

	public async getRewardsTVL(inputs?: {
		farmIds?: ObjectId[];
	}): Promise<number> {
		return this.fetchApi("rewards-tvl", inputs ?? {});
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

	public async getInteractionEvents(
		inputs: ApiIndexerEventsBody & {
			walletAddress: SuiAddress;
		}
	) {
		return this.fetchApiIndexerEvents<
			FarmUserEvent,
			ApiIndexerEventsBody & {
				walletAddress: SuiAddress;
			}
		>("events-by-user", inputs);
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
