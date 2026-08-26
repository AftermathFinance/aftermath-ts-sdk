import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	ApiIndexerEventsBody,
	CallerConfig,
	ObjectId,
	SuiAddress,
} from "../../types";
import { FarmsStakedPosition } from "./farmsStakedPosition";
import { FarmsStakingPool } from "./farmsStakingPool";
import type {
	ApiFarmsCreateStakingPoolBody,
	ApiFarmsCreateStakingPoolBodyV1,
	ApiFarmsOwnedStakedPositionsBody,
	ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody,
	ApiFarmsOwnedStakingPoolOwnerCapsBody,
	ApiFarmsSummaryBody,
	FarmSummary,
	FarmsStakedPositionObject,
	FarmsStakingPoolObject,
	FarmUserEvent,
	StakingPoolOneTimeAdminCapObject,
	StakingPoolOwnerCapObject,
} from "./farmsTypes";

/**
 * High-level reads and transaction builders for Sui staking pools.
 *
 * The class reads pools, positions, capabilities, TVL, summaries, and user
 * events through the farm API. Its transaction methods delegate to
 * `AftermathApi.Farms()` and return unsigned transaction data. They do not
 * sign or submit transactions. Pass an `AftermathApi` instance to the
 * constructor when you use those builders.
 *
 * @example
 * ```typescript
 * const farms = new Farms({ network: "MAINNET" });
 * const pools = await farms.getAllStakingPools();
 * ```
 */
export class Farms extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/** Thresholds used by the high-level reward and multiplier helpers. */
	public static readonly constants = {
		/**
		 * Minimum claimable reward amount, in the reward coin's base units.
		 * Rewards below this threshold are reported as zero by
		 * `FarmsStakedPosition.rewardsEarned`.
		 */
		minRewardsToClaim: BigInt(10),
		/**
		 * Maximum human-readable lock multiplier exposed by the legacy helper,
		 * represented as `2` for a 2x multiplier. Pool objects store the precise
		 * value as an 18-decimal fixed-point `bigint`.
		 */
		maxLockMultiplier: 2,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a `Farms` instance for farm API reads and transaction builders.
 *
	 * @param config - Optional network, API-host, and access-token configuration.
	 * @param api - Optional provider used by transaction builders. Reads do not require it.
	 */
	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
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
	 * @param abortSignal - Optional signal that cancels the API request.
	 * @returns A `FarmsStakingPool` object representing the staking pool.
	 *
	 * @example
	 * ```typescript
	 * const pool = await farms.getStakingPool({ objectId: "0x<pool_id>" });
	 * console.log(pool.stakingPool);
	 * ```
	 */
	public async getStakingPool(
		inputs: { objectId: ObjectId },
		abortSignal?: AbortSignal
	): Promise<FarmsStakingPool> {
		const stakingPool = await this.fetchApi<FarmsStakingPoolObject>(
			inputs.objectId,
			undefined,
			abortSignal
		);
		return new FarmsStakingPool(stakingPool, this.config, this.api);
	}

	/**
	 * Fetches multiple staking pools by their `objectIds`.
	 *
	 * @param inputs - An object containing an array of `objectIds`.
	 * @param abortSignal - Optional signal that cancels the API request.
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
	public async getStakingPools(
		inputs: { objectIds: ObjectId[] },
		abortSignal?: AbortSignal
	): Promise<FarmsStakingPool[]> {
		const stakingPools = await this.fetchApi<
			FarmsStakingPoolObject[],
			{
				farmIds: ObjectId[];
			}
		>(
			"",
			{
				farmIds: inputs.objectIds,
			},
			abortSignal
		);
		return stakingPools.map(
			(stakingPool) => new FarmsStakingPool(stakingPool, this.config, this.api)
		);
	}

	/**
	 * Fetches all existing staking pools registered within the indexer or farm API.
	 *
	 * @param abortSignal - Optional signal that cancels the API request.
	 * @returns An array of `FarmsStakingPool` objects.
	 *
	 * @example
	 * ```typescript
	 * const allPools = await farms.getAllStakingPools();
	 * console.log(allPools.map(pool => pool.stakingPool));
	 * ```
	 */
	public async getAllStakingPools(abortSignal?: AbortSignal) {
		const stakingPools: FarmsStakingPoolObject[] = await this.fetchApi(
			"",
			{},
			abortSignal
		);
		return stakingPools.map(
			(pool) => new FarmsStakingPool(pool, this.config, this.api)
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
			(pool) => new FarmsStakedPosition(pool, undefined, this.config, this.api)
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
	): Promise<StakingPoolOwnerCapObject[]> {
		return this.fetchApi("owned-staking-pool-owner-caps", inputs);
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
	): Promise<StakingPoolOneTimeAdminCapObject[]> {
		return this.fetchApi("owned-staking-pool-one-time-admin-caps", inputs);
	}

	// =========================================================================
	//  Stats
	// =========================================================================

	/**
	 * Retrieves the total value locked (TVL) in the specified farm IDs or in all farms if none are specified.
	 *
	 * @param inputs - An optional object containing an array of `farmIds` to filter TVL by. If not provided, returns global TVL.
	 * @param abortSignal - Optional signal that cancels the API request.
	 * @returns A promise that resolves to the TVL as a `number` in the API's reporting currency.
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
	public async getTVL(
		inputs?: { farmIds?: ObjectId[] },
		abortSignal?: AbortSignal
	): Promise<number> {
		return this.fetchApi("tvl", inputs ?? {}, abortSignal);
	}

	/**
	 * Retrieves the total value locked (TVL) of reward coins across specified farm IDs or all farms if none are specified.
	 *
	 * @param inputs - An optional object containing an array of `farmIds`. If not provided, returns global reward TVL.
	 * @param abortSignal - Optional signal that cancels the API request.
	 * @returns A promise that resolves to the reward TVL as a `number` in the API's reporting currency.
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
	public async getRewardsTVL(
		inputs?: { farmIds?: ObjectId[] },
		abortSignal?: AbortSignal
	): Promise<number> {
		return this.fetchApi("rewards-tvl", inputs ?? {}, abortSignal);
	}

	/**
	 * Fetches TVL and reward TVL for multiple farms in a single batch response.
	 * When `farmIds` is omitted, the API returns summaries for all farms.
	 *
	 * @param inputs - Optionally provide the farm IDs to include.
	 * @param abortSignal - An optional signal for cancelling the request.
	 * @returns TVL and reward TVL metrics for each requested farm.
	 */
	public async getFarmSummaries(
		inputs?: ApiFarmsSummaryBody,
		abortSignal?: AbortSignal
	): Promise<FarmSummary[]> {
		return this.fetchApi("summary", inputs ?? {}, abortSignal);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * **Deprecated**: Use `getCreateStakingPoolTransactionV2()` instead.
	 *
	 * Builds a transaction to create a new staking pool (farming vault) on version 1 of the farm system.
	 *
	 * @param inputs - Pool durations in milliseconds, fixed-point multiplier, minimum stake, coin type, and creator address.
	 * @returns A transaction object (or bytes) that can be signed and submitted.
	 *
	 * @deprecated Please use `getCreateStakingPoolTransactionV2`.
	 */
	public async getCreateStakingPoolTransactionV1(
		inputs: ApiFarmsCreateStakingPoolBodyV1
	) {
		return this.farmsApi().buildCreateStakingPoolTxV1(inputs);
	}

	/**
	 * Builds a transaction to create a new staking pool (farming vault) on version 2 of the farm system.
	 *
	 * @param inputs - Pool durations in milliseconds, fixed-point multiplier, minimum stake, coin type, and creator address.
	 * @returns A transaction object (or bytes) that can be signed and submitted.
	 * @throws An error if no `AftermathApi` instance was provided.
	 *
	 * @example
	 * ```typescript
	 * const tx = await farms.getCreateStakingPoolTransactionV2({
	 *   minLockDurationMs: 604800000, // 1 week
	 *   maxLockDurationMs: 31536000000, // 1 year
	 *   maxLockMultiplier: BigInt("2000000000000000000"), // 2.0x in 18-decimal fixed point
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
		return this.farmsApi().buildCreateStakingPoolTxV2(inputs);
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
	private readonly farmsApi = () => {
		const farms = this.api?.Farms();
		if (!farms) {
			throw new Error("missing AftermathApi instance");
		}
		return farms;
	};
}
