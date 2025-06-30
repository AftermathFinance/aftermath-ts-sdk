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
	ApiFarmsCreateStakingPoolBodyV1,
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

/**
 * The `Farms` class provides high-level methods for interacting with
 * staking pools (farms) on the Sui network. It allows fetching pool
 * details, user staked positions, and building transactions for creating
 * new pools. This class also enables retrieving user interactions (events)
 * with the farming system.
 */
export class Farms extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Contains constants relevant to farming, including minimum rewards to claim
	 * and maximum lock multipliers.
	 */
	public static readonly constants = {
		/**
		 * The minimum number of rewards (in smallest units) that can be claimed.
		 */
		minRewardsToClaim: BigInt(10),
		/**
		 * The maximum lock multiplier that can be applied when locking a staked position.
		 */
		maxLockMultiplier: 18,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `Farms` instance for fetching staking pool data and building
	 * farm-related transactions.
	 *
	 * @param config - Optional configuration, including network and access token.
	 * @param Provider - An optional `AftermathApi` instance for advanced transaction building.
	 */
	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "farms");
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetches a single staking pool by its `objectId` from the farm API/indexer.
	 *
	 * @param inputs - An object containing the `objectId` of the staking pool.
	 * @returns A `FarmsStakingPool` object representing the staking pool.
	 *
	 * @example
	 * ```typescript
	 * const pool = await farms.getStakingPool({ objectId: "0x<pool_id>" });
	 * console.log(pool.stakingPool);
	 * ```
	 */
	public async getStakingPool(inputs: {
		objectId: ObjectId;
	}): Promise<FarmsStakingPool> {
		const stakingPool = await this.fetchApi<FarmsStakingPoolObject>(
			inputs.objectId
		);
		return new FarmsStakingPool(stakingPool, this.config, this.Provider);
	}

	/**
	 * Fetches multiple staking pools by their `objectIds`.
	 *
	 * @param inputs - An object containing an array of `objectIds`.
	 * @returns An array of `FarmsStakingPool` instances corresponding to each `objectId`.
	 *
	 * @example
	 * ```typescript
	 * const pools = await farms.getStakingPools({
	 *   objectIds: ["0x<id1>", "0x<id2>"]
	 * });
	 * console.log(pools[0].stakingPool, pools[1].stakingPool);
	 * ```
	 */
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

	/**
	 * Fetches all existing staking pools registered within the indexer or farm API.
	 *
	 * @returns An array of `FarmsStakingPool` objects.
	 *
	 * @example
	 * ```typescript
	 * const allPools = await farms.getAllStakingPools();
	 * console.log(allPools.map(pool => pool.stakingPool));
	 * ```
	 */
	public async getAllStakingPools() {
		const stakingPools: FarmsStakingPoolObject[] = await this.fetchApi(
			"",
			{}
		);
		return stakingPools.map(
			(pool) => new FarmsStakingPool(pool, this.config, this.Provider)
		);
	}

	/**
	 * Fetches all staked positions owned by a given user.
	 *
	 * @param inputs - An object containing the user's `walletAddress`.
	 * @returns An array of `FarmsStakedPosition` objects representing each of the user's staked positions.
	 *
	 * @example
	 * ```typescript
	 * const positions = await farms.getOwnedStakedPositions({
	 *   walletAddress: "0x<user_address>"
	 * });
	 * console.log(positions);
	 * ```
	 */
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

	/**
	 * Fetches all `StakingPoolOwnerCapObject`s that a given address owns.
	 * These caps grant the owner the ability to modify staking pool parameters.
	 *
	 * @param inputs - An object containing the owner's `walletAddress`.
	 * @returns An array of `StakingPoolOwnerCapObject`s.
	 *
	 * @example
	 * ```typescript
	 * const ownerCaps = await farms.getOwnedStakingPoolOwnerCaps({
	 *   walletAddress: "0x<user_address>"
	 * });
	 * console.log(ownerCaps);
	 * ```
	 */
	public async getOwnedStakingPoolOwnerCaps(
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	) {
		// In this code, the direct endpoint is commented out. We use the provider method.
		return this.useProvider().fetchOwnedStakingPoolOwnerCaps(inputs);
	}

	/**
	 * Fetches all `StakingPoolOneTimeAdminCapObject`s that a given address owns.
	 * These caps grant one-time admin privileges, typically for initializing reward coins.
	 *
	 * @param inputs - An object containing the admin's `walletAddress`.
	 * @returns An array of `StakingPoolOneTimeAdminCapObject`s.
	 *
	 * @example
	 * ```typescript
	 * const adminCaps = await farms.getOwnedStakingPoolOneTimeAdminCaps({
	 *   walletAddress: "0x<user_address>"
	 * });
	 * console.log(adminCaps);
	 * ```
	 */
	public async getOwnedStakingPoolOneTimeAdminCaps(
		inputs: ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody
	) {
		return this.useProvider().fetchOwnedStakingPoolOneTimeAdminCaps(inputs);
	}

	// =========================================================================
	//  Stats
	// =========================================================================

	/**
	 * Retrieves the total value locked (TVL) in the specified farm IDs or in all farms if none are specified.
	 *
	 * @param inputs - An optional object containing an array of `farmIds` to filter TVL by. If not provided, returns global TVL.
	 * @returns A promise that resolves to a `number` representing the TVL in USD (or another relevant currency).
	 *
	 * @example
	 * ```typescript
	 * const tvl = await farms.getTVL();
	 * console.log("All farms' TVL:", tvl);
	 *
	 * const tvlForSpecificFarm = await farms.getTVL({ farmIds: ["0x<farm_id>"] });
	 * console.log("Specific farm's TVL:", tvlForSpecificFarm);
	 * ```
	 */
	public async getTVL(inputs?: { farmIds?: ObjectId[] }): Promise<number> {
		return this.fetchApi("tvl", inputs ?? {});
	}

	/**
	 * Retrieves the total value locked (TVL) of reward coins across specified farm IDs or all farms if none are specified.
	 *
	 * @param inputs - An optional object containing an array of `farmIds`. If not provided, returns global reward TVL.
	 * @returns A promise that resolves to a `number` representing the total rewards TVL in USD (or another relevant currency).
	 *
	 * @example
	 * ```typescript
	 * const rewardsTvl = await farms.getRewardsTVL();
	 * console.log("All farms' rewards TVL:", rewardsTvl);
	 *
	 * const singleFarmRewardsTvl = await farms.getRewardsTVL({ farmIds: ["0x<farm_id>"] });
	 * console.log("Single farm's rewards TVL:", singleFarmRewardsTvl);
	 * ```
	 */
	public async getRewardsTVL(inputs?: {
		farmIds?: ObjectId[];
	}): Promise<number> {
		return this.fetchApi("rewards-tvl", inputs ?? {});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * **Deprecated**: Use `getCreateStakingPoolTransactionV2()` instead.
	 *
	 * Builds a transaction to create a new staking pool (farming vault) on version 1 of the farm system.
	 *
	 * @param inputs - Contains pool creation parameters such as `minLockDurationMs`, `maxLockDurationMs`, etc.
	 * @returns A transaction object (or bytes) that can be signed and submitted.
	 *
	 * @deprecated Please use `getCreateStakingPoolTransactionV2`.
	 */
	public async getCreateStakingPoolTransactionV1(
		inputs: ApiFarmsCreateStakingPoolBodyV1
	) {
		return this.useProvider().buildCreateStakingPoolTxV1(inputs);
	}

	/**
	 * Builds a transaction to create a new staking pool (farming vault) on version 2 of the farm system.
	 *
	 * @param inputs - Contains pool creation parameters such as `minLockDurationMs`, `maxLockDurationMs`, etc.
	 * @returns A transaction object (or bytes) that can be signed and submitted.
	 *
	 * @example
	 * ```typescript
	 * const tx = await farms.getCreateStakingPoolTransactionV2({
	 *   minLockDurationMs: 604800000, // 1 week
	 *   maxLockDurationMs: 31536000000, // 1 year
	 *   maxLockMultiplier: BigInt("2000000000"), // e.g. 2.0x
	 *   minStakeAmount: BigInt("1000000"),
	 *   stakeCoinType: "0x<coin_type>",
	 *   walletAddress: "0x<admin_address>"
	 * });
	 * // sign and submit the transaction
	 * ```
	 */
	public async getCreateStakingPoolTransactionV2(
		inputs: ApiFarmsCreateStakingPoolBody
	) {
		return this.useProvider().buildCreateStakingPoolTxV2(inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches user-specific farm interaction events (e.g., staked, unlocked, withdrew) with optional pagination.
	 *
	 * @param inputs - Includes the user's `walletAddress`, along with `cursor` and `limit` for pagination.
	 * @returns A paginated set of events of type `FarmUserEvent`.
	 *
	 * @example
	 * ```typescript
	 * const userEvents = await farms.getInteractionEvents({
	 *   walletAddress: "0x<user_address>",
	 *   cursor: 0,
	 *   limit: 10
	 * });
	 * console.log(userEvents);
	 * ```
	 */
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

	/**
	 * Retrieves an instance of the `Farms` provider from the passed `AftermathApi`,
	 * throwing an error if not available.
	 */
	private useProvider = () => {
		const provider = this.Provider?.Farms();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
