import type { AftermathApi } from "../../general/providers";
import { Casting, Helpers } from "../../general/utils";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import type {
	Apr,
	Balance,
	CallerConfig,
	CoinsToDecimals,
	CoinsToPrice,
	CoinType,
	ObjectId,
	SuiAddress,
	Timestamp,
} from "../../types";
import { Coin } from "../coin/coin";
import { Farms } from "./farms";
import type {
	ApiFarmsGrantOneTimeAdminCapBody,
	FarmOwnerOrOneTimeAdminCap,
	FarmsMultiplier,
	FarmsStakingPoolObject,
	FarmsStakingPoolRewardCoin,
	FarmsVersion,
} from "./farmsTypes";

/**
 * A local view of a staking pool, also called a vault on chain.
 *
 * The class exposes pool state, reward and multiplier calculations, TVL reads,
 * and version-aware transaction builders. Calculations mutate this instance's
 * `stakingPool` object but do not make network requests. Transaction builders
 * require an `AftermathApi` provider and return unsigned transaction data.
 */
export class FarmsStakingPool extends Caller {
	/**
	 * Creates a `FarmsStakingPool` instance from normalized pool data.
	 *
	 * @param stakingPool - Normalized pool data returned by a farm object read.
	 * @param config - Optional network and API-host configuration for TVL reads.
	 * @param api - Optional provider required by transaction builders.
	 */
	constructor(
		public stakingPool: FarmsStakingPoolObject,
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "farms");
		this.stakingPool = stakingPool;
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Stats
	// =========================================================================

	/**
	 * Fetches the total value locked (TVL) for this staking pool alone.
	 *
	 * @param abortSignal - Optional signal that cancels the API request.
	 * @returns A `number` representing this pool's TVL in the API's reporting currency.
	 *
	 * @example
	 * ```typescript
	 * const poolTvl = await someFarmsPool.getTVL();
	 * console.log(poolTvl);
	 * ```
	 */
	public async getTVL(abortSignal?: AbortSignal): Promise<number> {
		return new Farms(this.config, this.api).getTVL(
			{
				farmIds: [this.stakingPool.objectId],
			},
			abortSignal
		);
	}

	/**
	 * Fetches the total value locked (TVL) of the reward coins in this specific staking pool.
	 *
	 * @param abortSignal - Optional signal that cancels the API request.
	 * @returns A `number` representing this pool's reward TVL.
	 *
	 * @example
	 * ```typescript
	 * const rewardTvl = await someFarmsPool.getRewardsTVL();
	 * console.log(rewardTvl);
	 * ```
	 */
	public async getRewardsTVL(abortSignal?: AbortSignal): Promise<number> {
		return new Farms(this.config, this.api).getRewardsTVL(
			{
				farmIds: [this.stakingPool.objectId],
			},
			abortSignal
		);
	}

	// =========================================================================
	//  Getters
	// =========================================================================

	/**
	 * Retrieves the version of this staking pool (1 or 2).
	 */
	public version = (): FarmsVersion => {
		return this.stakingPool.version;
	};

	/**
	 * Returns whether this pool uses strict lock enforcement.
	 *
	 * A strictly locked position must reach its unlock time, or the pool must be
	 * forcibly opened, before principal can be withdrawn.
	 */
	public isStrictLockEnforcement = (): boolean => {
		return this.stakingPool.lockEnforcement === "Strict";
	};

	/**
	 * Returns whether this pool uses relaxed lock enforcement.
	 *
	 * The on-chain contract permits relaxed-lock principal withdrawals while the
	 * position is locked and applies its relaxed-lock reward rules.
	 */
	public isRelaxedLockEnforcement = (): boolean => {
		return this.stakingPool.lockEnforcement === "Relaxed";
	};

	/**
	 * Lists all reward coin types offered by this staking pool.
	 *
	 * @returns An array of `CoinType` strings.
	 */
	public rewardCoinTypes = (): CoinType[] => {
		return this.stakingPool.rewardCoins.map((coin) => coin.coinType);
	};

	/**
	 * Lists reward coin types that can currently be included in harvest inputs.
	 *
	 * A reward is included only when its actual pool balance is positive and at
	 * least one emission amount is available.
	 *
	 * @returns An array of eligible `CoinType` strings.
	 */
	public nonZeroRewardCoinTypes = (): CoinType[] => {
		return this.stakingPool.rewardCoins
			.filter(
				(coin) =>
					coin.emissionRate <= coin.actualRewards &&
					coin.actualRewards > BigInt(0)
			)
			.map((coin) => coin.coinType);
	};

	/**
	 * Retrieves the local record for a specific reward coin type in this pool.
	 *
	 * @param inputs - Contains the `coinType` to look up.
	 * @throws `Error` with `"Invalid coin type"` when the pool has no matching reward record.
	 * @returns The matching `FarmsStakingPoolRewardCoin` record.
	 */
	public rewardCoin = (inputs: { coinType: CoinType }) => {
		const foundCoin = this.stakingPool.rewardCoins.find(
			(coin) => coin.coinType === inputs.coinType
		);
		if (!foundCoin) {
			throw new Error("Invalid coin type");
		}

		return foundCoin;
	};

	/**
	 * Computes the maximum lock duration that remains valid in this pool.
	 *
	 * The result is the smaller of the configured maximum and the time until
	 * emission ends. It uses `Date.now()` and returns zero after emissions end.
	 *
	 * @returns The maximum possible lock duration in milliseconds, or 0 if the pool is effectively closed.
	 */
	public maxLockDurationMs = (): number => {
		return Math.max(
			Math.min(
				this.stakingPool.maxLockDurationMs,
				this.stakingPool.emissionEndTimestamp - Date.now()
			),
			0
		);
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Applies completed emission intervals to this local pool view.
	 *
	 * The method updates `rewardsAccumulatedPerShare` and each reward's last
	 * checkpoint. It emits nothing when the pool has no stake, waits until a full
	 * interval has elapsed, and caps emission at `rewardsRemaining`. It does not
	 * fetch fresh pool data or submit a transaction.
	 *
	 * @example
	 * ```typescript
	 * someFarmsPool.emitRewards();
	 * // The pool's rewardsAccumulatedPerShare fields are now updated.
	 * ```
	 */
	public emitRewards = () => {
		const currentTimestamp = Date.now();

		// If no staked amount, no distribution
		if (this.stakingPool.stakedAmount === BigInt(0)) {
			return;
		}

		const rewardCoins = Helpers.deepCopy(this.stakingPool.rewardCoins);

		for (const [rewardCoinIndex, rewardCoin] of rewardCoins.entries()) {
			// ib. Check that enough time has passed since the last emission.
			if (
				currentTimestamp <
				rewardCoin.lastRewardTimestamp + rewardCoin.emissionSchedulesMs
			) {
				continue;
			}

			// iia. Calculate how many rewards have to be emitted.
			const rewardsToEmit = this.calcRewardsToEmit({ rewardCoin });
			if (rewardsToEmit === BigInt(0)) {
				continue;
			}

			// iii. Increase the amount of rewards emitted per share.
			this.increaseRewardsAccumulatedPerShare({
				rewardsToEmit,
				rewardCoinIndex,
			});

			const numberOfEmissions =
				(currentTimestamp - rewardCoin.lastRewardTimestamp) /
				rewardCoin.emissionSchedulesMs;

			// IMPORTANT: only increase by multiples of `emission_schedule_ms`.
			//
			// iv. Update reward's `last_reward_timestamp`.
			this.stakingPool.rewardCoins[rewardCoinIndex].lastRewardTimestamp =
				rewardCoin.lastRewardTimestamp +
				numberOfEmissions * rewardCoin.emissionSchedulesMs;
		}
	};

	/**
	 * Computes an approximate APR for one reward coin.
	 *
	 * The calculation annualizes the current discrete emission rate, converts the
	 * rate to USD with `price` and `decimals`, divides by `tvlUsd`, and assumes
	 * the pool's maximum lock multiplier. It returns zero when the price or TVL
	 * is not positive, emissions have not started or have ended, or the actual
	 * reward balance is below one emission amount.
	 *
	 * @param inputs - Includes the `coinType`, its `price` and `decimals`, plus the total `tvlUsd` in the pool.
	 * @returns APR as a decimal fraction, such as `0.05` for 5%.
	 */
	public calcApr = (inputs: {
		coinType: CoinType;
		price: number;
		decimals: number;
		tvlUsd: number;
	}): Apr => {
		const { coinType, price, decimals, tvlUsd } = inputs;
		if (price <= 0 || tvlUsd <= 0) {
			return 0;
		}

		const rewardCoin = this.rewardCoin({ coinType });
		const currentTimestamp = Date.now();

		// If the current emission rate is below the actual supply, or if the pool hasn't started or is ended, yield 0
		if (rewardCoin.emissionRate > rewardCoin.actualRewards) {
			return 0;
		}
		if (
			rewardCoin.emissionStartTimestamp > currentTimestamp ||
			currentTimestamp > this.stakingPool.emissionEndTimestamp
		) {
			return 0;
		}

		const emissionRateTokens = rewardCoin.emissionRate;
		const emissionRateUsd =
			Coin.balanceWithDecimals(emissionRateTokens, decimals) * price;

		const oneYearMs = 365 * 24 * 60 * 60 * 1000;
		const rewardsUsdOneYear =
			emissionRateUsd * (oneYearMs / rewardCoin.emissionSchedulesMs);

		// The final APR is normalized by total staked value and the maximum lock multiplier
		const apr =
			rewardsUsdOneYear /
			tvlUsd /
			Casting.bigIntToFixedNumber(this.stakingPool.maxLockMultiplier);

		return apr < 0 ? 0 : Number.isNaN(apr) ? 0 : apr;
	};

	/**
	 * Computes the sum of the approximate APR for every reward coin in the pool.
	 * Each component uses the maximum lock multiplier and the supplied price and
	 * decimal maps.
	 *
	 * @param inputs - Contains price data (`coinsToPrice`), decimal data (`coinsToDecimals`), and the total TVL in USD.
	 * @returns The combined APR as a decimal fraction, such as `0.10` for 10%.
	 */
	public calcTotalApr = (inputs: {
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: CoinsToDecimals;
		tvlUsd: number;
	}): Apr => {
		const { coinsToPrice, coinsToDecimals, tvlUsd } = inputs;

		const aprs = this.rewardCoinTypes().map((coinType) =>
			this.calcApr({
				coinType,
				price: coinsToPrice[coinType],
				decimals: coinsToDecimals[coinType],
				tvlUsd,
			})
		);
		return Helpers.sum(aprs);
	};

	/**
	 * Calculates the lock multiplier for a duration in milliseconds.
	 *
	 * The duration is clamped to the pool's minimum and maximum. The result is
	 * linearly interpolated between `1.0` and `maxLockMultiplier`; if the pool's
	 * minimum and maximum durations are equal, the result is `1.0`.
	 *
	 * @param inputs - An object containing the `lockDurationMs` for which to calculate a multiplier.
	 * @returns An 18-decimal fixed-point `FarmsMultiplier`; `1e18n` represents `1.0`.
	 */
	public calcMultiplier = (inputs: {
		lockDurationMs: number;
	}): FarmsMultiplier => {
		const lockDurationMs =
			inputs.lockDurationMs > this.stakingPool.maxLockDurationMs
				? this.stakingPool.maxLockDurationMs
				: inputs.lockDurationMs < this.stakingPool.minLockDurationMs
					? this.stakingPool.minLockDurationMs
					: inputs.lockDurationMs;

		const totalPossibleLockDurationMs =
			this.stakingPool.maxLockDurationMs - this.stakingPool.minLockDurationMs;

		const newMultiplier =
			1 +
			((lockDurationMs - this.stakingPool.minLockDurationMs) /
				(totalPossibleLockDurationMs <= 0 ? 1 : totalPossibleLockDurationMs)) *
				(Casting.bigIntToFixedNumber(this.stakingPool.maxLockMultiplier) - 1);

		const multiplier = Casting.numberToFixedBigInt(newMultiplier);
		return multiplier < FixedUtils.fixedOneB
			? FixedUtils.fixedOneB
			: Helpers.minBigInt(multiplier, this.stakingPool.maxLockMultiplier);
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	/**
	 * Builds a version-aware transaction to stake tokens into this pool.
	 *
	 * The pool ID and stake coin type come from `this.stakingPool`. The requested
	 * duration is in milliseconds, and the amount is in stake-coin base units.
	 * V1 and V2 builders are selected from `version()`.
	 *
	 * @param inputs - Principal, lock duration, sender address, and optional sponsorship.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 *
	 * @example
	 * ```typescript
	 * const tx = await pool.getStakeTransaction({
	 *	 stakeAmount: 1_000_000n,
	 *	 lockDurationMs: 604_800_000,
	 *	 walletAddress: "0x<address>",
	 * });
	 * ```
	 */
	public async getStakeTransaction(inputs: {
		stakeAmount: Balance;
		lockDurationMs: Timestamp;
		walletAddress: SuiAddress;
		// lockEnforcement?: FarmsLockEnforcement;
		isSponsoredTx?: boolean;
	}) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		};
		return this.version() === 1
			? this.farmsApi().fetchBuildStakeTxV1(args)
			: this.farmsApi().fetchBuildStakeTxV2({
					...args,
				});
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	/**
	 * Builds a version-aware transaction to harvest rewards from multiple positions.
	 *
	 * The reward coin types are derived from `nonZeroRewardCoinTypes()` and the
	 * pool's stake coin type and ID are added automatically.
	 *
	 * @param inputs - Position object IDs and the signing wallet address.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getHarvestRewardsTransaction(inputs: {
		stakedPositionIds: ObjectId[];
		walletAddress: SuiAddress;
	}) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
			rewardCoinTypes: this.nonZeroRewardCoinTypes(),
		};
		return this.version() === 1
			? this.farmsApi().buildHarvestRewardsTxV1(args)
			: this.farmsApi().buildHarvestRewardsTxV2(args);
	}

	// =========================================================================
	//  Mutation/Creation Transactions (Owner Only)
	// =========================================================================

	/**
	 * Builds a version-aware transaction to increase emission schedules for reward coins.
	 *
	 * The on-chain contract requires the owner capability and rejects updates that
	 * do not increase the configured emissions.
	 *
	 * @param inputs - Owner capability, reward emission updates, and signing wallet.
	 * @returns An unsigned transaction to be signed by the owner-cap holder.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getIncreaseRewardsEmissionsTransaction(inputs: {
		ownerCapId: ObjectId;
		rewards: {
			rewardCoinType: CoinType;
			emissionScheduleMs: Timestamp;
			emissionRate: bigint;
		}[];
		walletAddress: SuiAddress;
	}) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		};
		return this.version() === 1
			? this.farmsApi().buildIncreaseStakingPoolRewardsEmissionsTxV1(args)
			: this.farmsApi().buildIncreaseStakingPoolRewardsEmissionsTxV2(args);
	}

	/**
	 * Builds a transaction to update the pool's minimum stake amount.
	 *
	 * The amount is in stake-coin base units, and the owner capability must
	 * authorize the mutation.
	 *
	 * @param inputs - New minimum amount, owner capability, and signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getUpdateMinStakeAmountTransaction(inputs: {
		ownerCapId: ObjectId;
		minStakeAmount: bigint;
		walletAddress: SuiAddress;
	}) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		};
		return this.version() === 1
			? this.farmsApi().buildSetStakingPoolMinStakeAmountTxV1(args)
			: this.farmsApi().buildSetStakingPoolMinStakeAmountTxV2(args);
	}

	/**
	 * Builds a V2 transaction to set the pool's minimum lock duration.
	 *
	 * `lockDurationMs` is in milliseconds. The owner capability must authorize
	 * the mutation. V1 pools do not expose this entry point.
	 *
	 * @param inputs - Owner capability, new duration, and signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws `Error` when this is a V1 pool or no `AftermathApi` is available.
	 */
	public getSetMinLockDurationMsTransaction(inputs: {
		ownerCapId: ObjectId;
		lockDurationMs: bigint;
		walletAddress: SuiAddress;
	}) {
		if (this.version() === 1) {
			throw new Error(
				"set_min_lock_duration_ms is not supported on V1 staking pools"
			);
		}
		return this.farmsApi().buildSetStakingPoolMinLockDurationMsTxV2({
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		});
	}

	/**
	 * Builds a V2 transaction to set the pool's maximum lock duration.
	 *
	 * `lockDurationMs` is in milliseconds. The owner capability must authorize
	 * the mutation. V1 pools do not expose this entry point.
	 *
	 * @param inputs - Owner capability, new duration, and signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws `Error` when this is a V1 pool or no `AftermathApi` is available.
	 */
	public getSetMaxLockDurationMsTransaction(inputs: {
		ownerCapId: ObjectId;
		lockDurationMs: bigint;
		walletAddress: SuiAddress;
	}) {
		if (this.version() === 1) {
			throw new Error(
				"set_max_lock_duration_ms is not supported on V1 staking pools"
			);
		}
		return this.farmsApi().buildSetStakingPoolMaxLockDurationMsTxV2({
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		});
	}

	/**
	 * Builds a transaction granting a one-time admin capability to another address.
	 *
	 * The capability is scoped to the pool and reward coin supplied in `inputs`.
	 * Only the current owner can grant it.
	 *
	 * @param inputs - Owner capability, recipient, reward coin type, and signing wallet.
	 * @returns An unsigned transaction to be executed by the pool owner.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public getGrantOneTimeAdminCapTransaction(
		inputs: ApiFarmsGrantOneTimeAdminCapBody
	) {
		return this.version() === 1
			? this.farmsApi().buildGrantOneTimeAdminCapTxV1(inputs)
			: this.farmsApi().buildGrantOneTimeAdminCapTxV2(inputs);
	}

	// =========================================================================
	//  Mutation Transactions (Owner/Admin Only)
	// =========================================================================

	/**
	 * Builds a version-aware transaction to initialize a new reward coin in this pool.
	 *
	 * The reward amount and rate are in the reward coin's base units. The schedule
	 * and delay timestamps are in milliseconds. V1 and V2 choose different Move
	 * entry points, and V2 can consume a one-time admin capability.
	 *
	 * @param inputs - Reward amount, emission settings, reward type, authorizing capability, and wallet.
	 * @returns An unsigned transaction for reward initialization.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getInitializeRewardTransaction(
		inputs: {
			rewardAmount: Balance;
			emissionScheduleMs: Timestamp;
			emissionRate: bigint;
			emissionDelayTimestampMs: Timestamp;
			rewardCoinType: CoinType;
			walletAddress: SuiAddress;
			isSponsoredTx?: boolean;
		} & FarmOwnerOrOneTimeAdminCap
	) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		};
		return this.version() === 1
			? this.farmsApi().fetchBuildInitializeStakingPoolRewardTxV1(args)
			: this.farmsApi().fetchBuildInitializeStakingPoolRewardTxV2(args);
	}

	/**
	 * Builds a version-aware transaction to add balances to existing reward coins.
	 *
	 * Each amount is in the corresponding reward coin's base units. The owner or
	 * one-time admin capability must authorize the operation.
	 *
	 * @param inputs - Reward top-ups, authorizing capability, and signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getTopUpRewardsTransaction(
		inputs: {
			rewards: {
				rewardAmount: Balance;
				rewardCoinType: CoinType;
			}[];
			walletAddress: SuiAddress;
			isSponsoredTx?: boolean;
		} & FarmOwnerOrOneTimeAdminCap
	) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		};
		return this.version() === 1
			? this.farmsApi().fetchBuildTopUpStakingPoolRewardsTxV1(args)
			: this.farmsApi().fetchBuildTopUpStakingPoolRewardsTxV2(args);
	}

	/**
	 * Builds a transaction to **remove (withdraw) undistributed reward coins** from the
	 * staking pool for **one or more reward coin types** in a single call.
	 *
	 * Only the **pool owner** (via `ownerCapId`) can remove rewards. One-time admin caps
	 * are **not** permitted for removals. This operation reduces the pool’s remaining
	 * undistributed reward balances; it does **not** affect rewards already accrued/claimed
	 * by stakers.
	 *
	 * Versioning:
	 * - V1 → calls `buildRemoveStakingPoolRewardTxV1`
	 * - V2 → calls `buildRemoveStakingPoolRewardTxV2`
	 *
	 * The effective `stakingPoolId` and `stakeCoinType` always come from this
	 * instance's `stakingPool`.
	 *
	 * @param inputs Parameters for reward removal.
	 * @param inputs.rewards Array of removal entries. Each entry specifies:
	 *   - `rewardCoinType`: Coin type to withdraw.
	 *   - `rewardAmount`: Amount to withdraw (base units).
	 * @param inputs.ownerCapId Object ID of the pool OwnerCap that authorizes the removal.
	 * @param inputs.walletAddress Address that will sign/submit the transaction.
	 * @returns A transaction object ready to sign and execute that removes the specified
	 *          undistributed rewards for each entry in `inputs.rewards`.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public getRemoveRewardsTransaction(inputs: {
		rewards: {
			rewardCoinType: CoinType;
			rewardAmount: Balance;
		}[];
		ownerCapId: ObjectId;
		walletAddress: SuiAddress;
	}) {
		const args = {
			...inputs,
			stakeCoinType: this.stakingPool.stakeCoinType,
			stakingPoolId: this.stakingPool.objectId,
		};
		return this.version() === 1
			? this.farmsApi().buildRemoveStakingPoolRewardTxV1(args)
			: this.farmsApi().buildRemoveStakingPoolRewardTxV2(args);
	}

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Updates `rewardsAccumulatedPerShare` by distributing `rewardsToEmit` among
	 * the total staked amount with multiplier. This mimics on-chain distribution logic.
	 *
	 * @param inputs - Contains the `rewardsToEmit` and which `rewardCoinIndex` to update.
	 */
	private increaseRewardsAccumulatedPerShare(inputs: {
		rewardsToEmit: Balance;
		rewardCoinIndex: number;
	}) {
		const { rewardsToEmit, rewardCoinIndex } = inputs;
		const stakedWithMultiplier = this.stakingPool.stakedAmountWithMultiplier;

		if (stakedWithMultiplier === BigInt(0)) {
			return;
		}

		// Distribute proportionally
		const newRewardsAccumulatedPerShare =
			(rewardsToEmit * BigInt(1_000_000_000_000_000_000)) /
			stakedWithMultiplier;

		if (newRewardsAccumulatedPerShare === BigInt(0)) {
			return;
		}

		this.stakingPool.rewardCoins[rewardCoinIndex].rewardsAccumulatedPerShare +=
			newRewardsAccumulatedPerShare;
	}

	/**
	 * Computes how many rewards to emit based on the time since `lastRewardTimestamp` and
	 * the pool's emission schedule, clamped by the total `rewardsRemaining`.
	 */
	private calcRewardsToEmit(inputs: {
		rewardCoin: FarmsStakingPoolRewardCoin;
	}): Balance {
		const { rewardCoin } = inputs;
		const currentTimestamp = Date.now();

		// Calculate the number of rewards that have been emitted since the last time this reward was emitted.
		const rewardsToEmit = this.calcRewardsEmittedFromTimeTmToTn({
			timestampTm: rewardCoin.lastRewardTimestamp,
			timestampTn: currentTimestamp,
			rewardCoin,
		});
		const { rewardsRemaining } = rewardCoin;

		// IMPORTANT: Cap the amount of rewards to emit by the amount of remaining rewards.
		return rewardsRemaining < rewardsToEmit ? rewardsRemaining : rewardsToEmit;
	}

	/**
	 * Calculates how many tokens were emitted between two timestamps (Tm and Tn) for a given reward coin,
	 * based on the discrete `emissionRate` and `emissionSchedulesMs`.
	 *
	 * @param inputs - Contains `timestampTm`, `timestampTn`, and the relevant `rewardCoin`.
	 * @returns The total number of tokens emitted in that time window.
	 */
	private calcRewardsEmittedFromTimeTmToTn(inputs: {
		timestampTm: Timestamp;
		timestampTn: Timestamp;
		rewardCoin: FarmsStakingPoolRewardCoin;
	}): Balance {
		const { timestampTm, timestampTn, rewardCoin } = inputs;
		const numberOfEmissionsFromTimeTmToTn =
			rewardCoin.emissionSchedulesMs === 0
				? 0
				: (timestampTn - timestampTm) / rewardCoin.emissionSchedulesMs;

		return (
			BigInt(Math.floor(numberOfEmissionsFromTimeTmToTn)) *
			rewardCoin.emissionRate
		);
	}

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Provides access to the farm-specific provider methods for building transactions.
	 */
	private readonly farmsApi = () => {
		const farms = this.api?.Farms();
		if (!farms) {
			throw new Error("missing AftermathApi instance");
		}
		return farms;
	};
}
