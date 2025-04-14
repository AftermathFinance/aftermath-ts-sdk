import {
	Apr,
	Balance,
	CallerConfig,
	CoinType,
	CoinsToDecimals,
	CoinsToPrice,
	ObjectId,
	SuiAddress,
	SuiNetwork,
	Timestamp,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsGrantOneTimeAdminCapBody,
	ApiFarmsIncreaseStakingPoolRewardsEmissionsBody,
	ApiFarmsInitializeStakingPoolRewardBody,
	ApiFarmsTopUpStakingPoolRewardsBody,
	FarmOwnerOrOneTimeAdminCap,
	FarmsMultiplier,
	FarmsStakingPoolObject,
	FarmsStakingPoolRewardCoin,
	FarmsVersion,
} from "./farmsTypes";
import { Casting, Helpers } from "../../general/utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Coin } from "../coin/coin";
import { AftermathApi } from "../../general/providers";
import { Farms } from "./farms";

/**
 * The `FarmsStakingPool` class represents a staking pool (also referred
 * to as a "vault" in some contexts). It allows reading details about
 * emission schedules, reward tokens, stake coin type, and lock durations,
 * as well as constructing transactions to stake, harvest, and mutate the
 * pool parameters if the user has the correct admin privileges.
 */
export class FarmsStakingPool extends Caller {
	/**
	 * Creates a `FarmsStakingPool` instance based on on-chain pool data.
	 *
	 * @param stakingPool - The on-chain data object describing the pool.
	 * @param config - An optional `CallerConfig` for network settings.
	 * @param Provider - An optional `AftermathApi` for transaction building.
	 */
	constructor(
		public stakingPool: FarmsStakingPoolObject,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
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
	 * @returns A `number` representing this pool's TVL in USD (or another currency).
	 *
	 * @example
	 * ```typescript
	 * const poolTvl = await someFarmsPool.getTVL();
	 * console.log(poolTvl);
	 * ```
	 */
	public async getTVL(): Promise<number> {
		return new Farms(this.config, this.Provider).getTVL({
			farmIds: [this.stakingPool.objectId],
		});
	}

	/**
	 * Fetches the total value locked (TVL) of the reward coins in this specific staking pool.
	 *
	 * @returns A `number` representing this pool's reward TVL.
	 *
	 * @example
	 * ```typescript
	 * const rewardTvl = await someFarmsPool.getRewardsTVL();
	 * console.log(rewardTvl);
	 * ```
	 */
	public async getRewardsTVL(): Promise<number> {
		return new Farms(this.config, this.Provider).getRewardsTVL({
			farmIds: [this.stakingPool.objectId],
		});
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
	 * Lists all reward coin types offered by this staking pool.
	 *
	 * @returns An array of `CoinType` strings.
	 */
	public rewardCoinTypes = (): CoinType[] => {
		return this.stakingPool.rewardCoins.map((coin) => coin.coinType);
	};

	/**
	 * Lists all reward coin types for which this pool currently has a non-zero actual reward balance.
	 *
	 * @returns An array of `CoinType` strings that have > 0 actual rewards.
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
	 * Retrieves the on-chain record for a specific reward coin type in this pool.
	 *
	 * @param inputs - Contains the `coinType` to look up.
	 * @throws If the specified coinType is not found in `rewardCoins`.
	 * @returns A `FarmsStakingPoolRewardCoin` object.
	 */
	public rewardCoin = (inputs: { coinType: CoinType }) => {
		const foundCoin = this.stakingPool.rewardCoins.find(
			(coin) => coin.coinType === inputs.coinType
		);
		if (!foundCoin) throw new Error("Invalid coin type");

		return foundCoin;
	};

	/**
	 * Computes the maximum lock duration (in ms) that remains valid in this staking pool,
	 * factoring in the current time and the pool's emission end.
	 *
	 * @returns The maximum possible lock duration in milliseconds, or 0 if the pool is effectively closed.
	 */
	public maxLockDurationMs = (): number => {
		return Math.max(
			Math.min(
				this.stakingPool.maxLockDurationMs,
				this.stakingPool.emissionEndTimestamp - dayjs().valueOf()
			),
			0
		);
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates and applies newly emitted rewards for each reward coin in this pool,
	 * updating the `rewardsAccumulatedPerShare`. This simulates the on-chain
	 * `emitRewards` logic.
	 *
	 * @example
	 * ```typescript
	 * someFarmsPool.emitRewards();
	 * // The pool's rewardsAccumulatedPerShare fields are now updated.
	 * ```
	 */
	public emitRewards = () => {
		const currentTimestamp = dayjs().valueOf();

		// If no staked amount, no distribution
		if (this.stakingPool.stakedAmount === BigInt(0)) return;

		const rewardCoins = Helpers.deepCopy(this.stakingPool.rewardCoins);

		for (const [rewardCoinIndex, rewardCoin] of rewardCoins.entries()) {
			// ib. Check that enough time has passed since the last emission.
			if (
				currentTimestamp <
				rewardCoin.lastRewardTimestamp + rewardCoin.emissionSchedulesMs
			)
				continue;

			// iia. Calculate how many rewards have to be emitted.
			const rewardsToEmit = this.calcRewardsToEmit({ rewardCoin });
			if (rewardsToEmit === BigInt(0)) continue;

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
	 * Computes an approximate APR for a specific reward coin, based on the current
	 * emission rate, coin price, pool TVL, and the lock multiplier range. This assumes
	 * maximum lock multiplier for the final APR result.
	 *
	 * @param inputs - Includes the `coinType`, its `price` and `decimals`, plus the total `tvlUsd` in the pool.
	 * @returns A numeric APR (0.05 = 5%).
	 */
	public calcApr = (inputs: {
		coinType: CoinType;
		price: number;
		decimals: number;
		tvlUsd: number;
	}): Apr => {
		const { coinType, price, decimals, tvlUsd } = inputs;
		if (price <= 0 || tvlUsd <= 0) return 0;

		const rewardCoin = this.rewardCoin({ coinType });
		const currentTimestamp = dayjs().valueOf();

		// If the current emission rate is below the actual supply, or if the pool hasn't started or is ended, yield 0
		if (rewardCoin.emissionRate > rewardCoin.actualRewards) return 0;
		if (
			rewardCoin.emissionStartTimestamp > currentTimestamp ||
			currentTimestamp > this.stakingPool.emissionEndTimestamp
		) {
			return 0;
		}

		const emissionRateTokens = rewardCoin.emissionRate;
		const emissionRateUsd =
			Coin.balanceWithDecimals(emissionRateTokens, decimals) * price;

		dayjs.extend(duration);
		const oneYearMs = dayjs.duration(1, "year").asMilliseconds();
		const rewardsUsdOneYear =
			emissionRateUsd * (oneYearMs / rewardCoin.emissionSchedulesMs);

		// The final APR is normalized by total staked value and the maximum lock multiplier
		const apr =
			rewardsUsdOneYear /
			tvlUsd /
			Casting.bigIntToFixedNumber(this.stakingPool.maxLockMultiplier);

		return apr < 0 ? 0 : isNaN(apr) ? 0 : apr;
	};

	/**
	 * Computes the total APR contributed by all reward coin types in this pool, summing
	 * up the individual APR for each coin type. This also assumes max lock multiplier.
	 *
	 * @param inputs - Contains price data (`coinsToPrice`), decimal data (`coinsToDecimals`), and the total TVL in USD.
	 * @returns The sum of all coin APRs (0.10 = 10%).
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
	 * Given a lock duration in ms, calculates the lock multiplier to be used by staked positions.
	 * This function clamps the input duration between the pool's `minLockDurationMs` and
	 * `maxLockDurationMs`.
	 *
	 * @param inputs - An object containing the `lockDurationMs` for which to calculate a multiplier.
	 * @returns A `FarmsMultiplier` (bigint) representing the scaled factor (1.0 = 1e9 if using fixedOneB).
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
			this.stakingPool.maxLockDurationMs -
			this.stakingPool.minLockDurationMs;

		const newMultiplier =
			1 +
			((lockDurationMs - this.stakingPool.minLockDurationMs) /
				(totalPossibleLockDurationMs <= 0
					? 1
					: totalPossibleLockDurationMs)) *
				(Casting.bigIntToFixedNumber(
					this.stakingPool.maxLockMultiplier
				) -
					1);

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
	 * Builds a transaction to stake tokens into this pool, optionally locking them.
	 *
	 * @param inputs - Contains `stakeAmount`, `lockDurationMs`, `walletAddress`, and optional sponsorship.
	 * @returns A transaction object (or bytes) that can be signed and executed to create a staked position.
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
			? this.useProvider().fetchBuildStakeTxV1(args)
			: this.useProvider().fetchBuildStakeTxV2({
					...args,
			  });
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	/**
	 * Builds a transaction to harvest rewards from multiple staked positions in this pool.
	 *
	 * @param inputs - Contains `stakedPositionIds`, the `walletAddress`, and optionally any others.
	 * @returns A transaction that can be signed and executed to claim rewards from multiple positions.
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
			? this.useProvider().fetchBuildHarvestRewardsTxV1(args)
			: this.useProvider().fetchBuildHarvestRewardsTxV2(args);
	}

	// =========================================================================
	//  Mutation/Creation Transactions (Owner Only)
	// =========================================================================

	/**
	 * Builds a transaction to increase the emission rate (or schedule) for specific reward coins.
	 *
	 * @param inputs - Contains the `ownerCapId` that authorizes changes, plus an array of `rewards` with new emission details.
	 * @returns A transaction to be signed and executed by the owner cap holder.
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
			? this.useProvider().fetchIncreaseStakingPoolRewardsEmissionsTxV1(
					args
			  )
			: this.useProvider().fetchIncreaseStakingPoolRewardsEmissionsTxV2(
					args
			  );
	}

	/**
	 * Builds a transaction to update the pool's minimum stake amount, only authorized by the `ownerCapId`.
	 *
	 * @param inputs - Contains the new `minStakeAmount`, the `ownerCapId`, and the calling `walletAddress`.
	 * @returns A transaction that can be signed and executed to change the minimum stake requirement.
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
			? this.useProvider().buildSetStakingPoolMinStakeAmountTxV1(args)
			: this.useProvider().buildSetStakingPoolMinStakeAmountTxV2(args);
	}

	/**
	 * Builds a transaction granting a one-time admin cap to another address, allowing them to perform specific
	 * one-time administrative actions (like initializing a reward).
	 *
	 * @param inputs - Body containing the `ownerCapId`, the `recipientAddress`, and the `rewardCoinType`.
	 * @returns A transaction to be executed by the current pool owner.
	 */
	public getGrantOneTimeAdminCapTransaction(
		inputs: ApiFarmsGrantOneTimeAdminCapBody
	) {
		return this.version() === 1
			? this.useProvider().buildGrantOneTimeAdminCapTxV1(inputs)
			: this.useProvider().buildGrantOneTimeAdminCapTxV2(inputs);
	}

	// =========================================================================
	//  Mutation Transactions (Owner/Admin Only)
	// =========================================================================

	/**
	 * Builds a transaction to initialize a new reward coin in this pool, specifying the amount, emission rate,
	 * and schedule parameters. This can be done by either the `ownerCapId` or a `oneTimeAdminCapId`.
	 *
	 * @param inputs - Contains emission info (rate, schedule) and which cap is used (`ownerCapId` or `oneTimeAdminCapId`).
	 * @returns A transaction object for the reward initialization.
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
			? this.useProvider().fetchBuildInitializeStakingPoolRewardTxV1(args)
			: this.useProvider().fetchBuildInitializeStakingPoolRewardTxV2(
					args
			  );
	}

	/**
	 * Builds a transaction to add more reward coins (top-up) to an existing reward
	 * coin configuration, either as the owner or via a one-time admin cap.
	 *
	 * @param inputs - Contains an array of reward objects, each specifying amount and coin type.
	 * @returns A transaction that can be signed and executed to increase the reward distribution pool.
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
			? this.useProvider().fetchBuildTopUpStakingPoolRewardsTxV1(args)
			: this.useProvider().fetchBuildTopUpStakingPoolRewardsTxV2(args);
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
		const stakedWithMultiplier =
			this.stakingPool.stakedAmountWithMultiplier;

		if (stakedWithMultiplier === BigInt(0)) return;

		// Distribute proportionally
		const newRewardsAccumulatedPerShare =
			(rewardsToEmit * BigInt(1_000_000_000_000_000_000)) /
			stakedWithMultiplier;

		if (newRewardsAccumulatedPerShare === BigInt(0)) return;

		this.stakingPool.rewardCoins[
			rewardCoinIndex
		].rewardsAccumulatedPerShare += newRewardsAccumulatedPerShare;
	}

	/**
	 * Computes how many rewards to emit based on the time since `lastRewardTimestamp` and
	 * the pool's emission schedule, clamped by the total `rewardsRemaining`.
	 */
	private calcRewardsToEmit(inputs: {
		rewardCoin: FarmsStakingPoolRewardCoin;
	}): Balance {
		const { rewardCoin } = inputs;
		const currentTimestamp = dayjs().valueOf();

		// Calculate the number of rewards that have been emitted since the last time this reward was emitted.
		const rewardsToEmit = this.calcRewardsEmittedFromTimeTmToTn({
			timestampTm: rewardCoin.lastRewardTimestamp,
			timestampTn: currentTimestamp,
			rewardCoin,
		});
		const { rewardsRemaining } = rewardCoin;

		// IMPORTANT: Cap the amount of rewards to emit by the amount of remaining rewards.
		return rewardsRemaining < rewardsToEmit
			? rewardsRemaining
			: rewardsToEmit;
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
	private useProvider = () => {
		const provider = this.Provider?.Farms();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
