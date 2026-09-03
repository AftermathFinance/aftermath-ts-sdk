import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import {
	effectivePageRequest,
	FARM_CATALOGUE_PAGE_SIZE,
	fetchAllOffsetPages,
	fetchExplicitChunks,
	isOffsetPageRequest,
	pageFromItems,
	SMALL_API_PAGE_SIZE,
} from "../../general/utils/offsetPagination";
import type {
	ApiIndexerEventsBody,
	ApiOffsetPageBody,
	ApiPage,
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
		const stakingPools = await fetchExplicitChunks({
			inputs: inputs.objectIds,
			fetchChunk: (farmIds) =>
				this.fetchApi<
					FarmsStakingPoolObject[],
					{ farmIds: ObjectId[]; limit: number }
				>("", { farmIds, limit: SMALL_API_PAGE_SIZE }, abortSignal),
		});
		return stakingPools.map(
			(stakingPool) => new FarmsStakingPool(stakingPool, this.config, this.api)
		);
	}

	/** Fetches one bounded page of staking pools. */
	public async getStakingPoolsPage(
		inputs: { objectIds?: ObjectId[] } & ApiOffsetPageBody = {},
		abortSignal?: AbortSignal
	): Promise<ApiPage<FarmsStakingPool>> {
		const request = effectivePageRequest(inputs, SMALL_API_PAGE_SIZE);
		if (inputs.objectIds) {
			const farmIds = inputs.objectIds.slice(
				request.cursor,
				request.cursor + request.limit
			);
			const rows = await this.fetchApi<
				FarmsStakingPoolObject[],
				{ farmIds: ObjectId[]; limit: number }
			>("", { farmIds, limit: SMALL_API_PAGE_SIZE }, abortSignal);
			return {
				items: rows.map(
					(row) => new FarmsStakingPool(row, this.config, this.api)
				),
				nextCursor:
					request.limit > 0 &&
					request.cursor + request.limit < inputs.objectIds.length
						? request.cursor + request.limit
						: undefined,
			};
		}
		const rows = await this.fetchApi<
			FarmsStakingPoolObject[],
			Required<ApiOffsetPageBody>
		>("", request, abortSignal);
		const page = pageFromItems(rows, request);
		return {
			items: page.items.map(
				(row) => new FarmsStakingPool(row, this.config, this.api)
			),
			nextCursor: page.nextCursor,
		};
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
		const stakingPools = await fetchAllOffsetPages({
			pageSize: FARM_CATALOGUE_PAGE_SIZE,
			identity: (pool: FarmsStakingPoolObject) => pool.objectId,
			fetchPage: (page) =>
				this.fetchApi<FarmsStakingPoolObject[], Required<ApiOffsetPageBody>>(
					"",
					page,
					abortSignal
				),
		});
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
		inputs: ApiFarmsOwnedStakedPositionsBody,
		abortSignal?: AbortSignal
	) {
		if (isOffsetPageRequest(inputs)) {
			const page = effectivePageRequest(inputs, SMALL_API_PAGE_SIZE);
			const positions = await this.fetchApi<
				FarmsStakedPositionObject[],
				ApiFarmsOwnedStakedPositionsBody
			>("owned-staked-positions", { ...inputs, ...page }, abortSignal);
			return positions.map(
				(position) =>
					new FarmsStakedPosition(position, undefined, this.config, this.api)
			);
		}
		const positions = await fetchAllOffsetPages({
			pageSize: SMALL_API_PAGE_SIZE,
			identity: (position: FarmsStakedPositionObject) => position.objectId,
			fetchPage: (page) =>
				this.fetchApi<
					FarmsStakedPositionObject[],
					ApiFarmsOwnedStakedPositionsBody & Required<ApiOffsetPageBody>
				>("owned-staked-positions", { ...inputs, ...page }, abortSignal),
		});
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
	public getOwnedStakingPoolOwnerCaps(
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody,
		abortSignal?: AbortSignal
	): Promise<StakingPoolOwnerCapObject[]> {
		if (isOffsetPageRequest(inputs)) {
			return this.fetchApi(
				"owned-staking-pool-owner-caps",
				{ ...inputs, ...effectivePageRequest(inputs, SMALL_API_PAGE_SIZE) },
				abortSignal
			);
		}
		return fetchAllOffsetPages({
			pageSize: SMALL_API_PAGE_SIZE,
			identity: (cap: StakingPoolOwnerCapObject) => cap.objectId,
			fetchPage: (page) =>
				this.fetchApi(
					"owned-staking-pool-owner-caps",
					{ ...inputs, ...page },
					abortSignal
				),
		});
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
	public getOwnedStakingPoolOneTimeAdminCaps(
		inputs: ApiFarmsOwnedStakingPoolOneTimeAdminCapsBody,
		abortSignal?: AbortSignal
	): Promise<StakingPoolOneTimeAdminCapObject[]> {
		if (isOffsetPageRequest(inputs)) {
			return this.fetchApi(
				"owned-staking-pool-one-time-admin-caps",
				{ ...inputs, ...effectivePageRequest(inputs, SMALL_API_PAGE_SIZE) },
				abortSignal
			);
		}
		return fetchAllOffsetPages({
			pageSize: SMALL_API_PAGE_SIZE,
			identity: (cap: StakingPoolOneTimeAdminCapObject) => cap.objectId,
			fetchPage: (page) =>
				this.fetchApi(
					"owned-staking-pool-one-time-admin-caps",
					{ ...inputs, ...page },
					abortSignal
				),
		});
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
		const farmIds = inputs?.farmIds ? [...new Set(inputs.farmIds)] : undefined;
		if (farmIds && farmIds.length > SMALL_API_PAGE_SIZE) {
			const values = await fetchExplicitChunks({
				inputs: farmIds,
				fetchChunk: async (farmIds) => [
					await this.fetchApi<number, { farmIds: ObjectId[] }>(
						"tvl",
						{ farmIds },
						abortSignal
					),
				],
			});
			return values.reduce((sum, value) => sum + value, 0);
		}
		return this.fetchApi("tvl", farmIds ? { farmIds } : {}, abortSignal);
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
		const farmIds = inputs?.farmIds ? [...new Set(inputs.farmIds)] : undefined;
		if (farmIds && farmIds.length > SMALL_API_PAGE_SIZE) {
			const values = await fetchExplicitChunks({
				inputs: farmIds,
				fetchChunk: async (farmIds) => [
					await this.fetchApi<number, { farmIds: ObjectId[] }>(
						"rewards-tvl",
						{ farmIds },
						abortSignal
					),
				],
			});
			return values.reduce((sum, value) => sum + value, 0);
		}
		return this.fetchApi(
			"rewards-tvl",
			farmIds ? { farmIds } : {},
			abortSignal
		);
	}

	/**
	 * Fetches TVL and reward TVL for multiple farms in a single batch response.
	 * When `farmIds` is omitted, the API returns summaries for all farms.
	 *
	 * @param inputs - Optionally provide the farm IDs to include.
	 * @param abortSignal - An optional signal for cancelling the request.
	 * @returns TVL and reward TVL metrics for each requested farm.
	 */
	public getFarmSummaries(
		inputs?: ApiFarmsSummaryBody,
		abortSignal?: AbortSignal
	): Promise<FarmSummary[]> {
		if (isOffsetPageRequest(inputs)) {
			const page = effectivePageRequest(inputs, SMALL_API_PAGE_SIZE);
			if (inputs?.farmIds) {
				const farmIds = inputs.farmIds.slice(
					page.cursor,
					page.cursor + page.limit
				);
				return this.fetchApi(
					"summary",
					{ farmIds, limit: SMALL_API_PAGE_SIZE },
					abortSignal
				);
			}
			return this.fetchApi("summary", page, abortSignal);
		}
		if (inputs?.farmIds) {
			return fetchExplicitChunks({
				inputs: inputs.farmIds,
				fetchChunk: (farmIds) =>
					this.fetchApi(
						"summary",
						{ farmIds, limit: SMALL_API_PAGE_SIZE },
						abortSignal
					),
			});
		}
		return fetchAllOffsetPages({
			pageSize: FARM_CATALOGUE_PAGE_SIZE,
			identity: (summary: FarmSummary) => summary.farmId,
			fetchPage: (page) => this.fetchApi("summary", page, abortSignal),
		});
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
	public getInteractionEvents(
		inputs: ApiIndexerEventsBody & {
			walletAddress: SuiAddress;
		}
	) {
		const limit = Math.min(
			inputs.limit ?? SMALL_API_PAGE_SIZE,
			SMALL_API_PAGE_SIZE
		);
		return this.fetchApiIndexerEvents<
			FarmUserEvent,
			ApiIndexerEventsBody & {
				walletAddress: SuiAddress;
			}
		>("events-by-user", { ...inputs, limit });
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
