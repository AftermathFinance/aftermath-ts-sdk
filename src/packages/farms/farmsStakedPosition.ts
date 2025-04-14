import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsDepositPrincipalBody,
	ApiFarmsLockBody,
	ApiFarmsRenewLockBody,
	ApiFarmsUnlockBody,
	ApiFarmsUnstakeBody,
	ApiHarvestFarmsRewardsBody,
	Apr,
	Balance,
	CallerConfig,
	CoinType,
	CoinsToBalance,
	FarmsStakedPositionObject,
	FarmsVersion,
	SuiAddress,
	SuiNetwork,
	Timestamp,
	Url,
} from "../../types";
import { FarmsStakingPool } from "./farmsStakingPool";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Helpers } from "../../general/utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Farms } from "./farms";
import { AftermathApi } from "../../general/providers";

/**
 * The `FarmsStakedPosition` class represents a user's individual staked position
 * in a particular staking pool. It provides methods to query position details,
 * calculate potential rewards, lock/unlock stake, and build transactions
 * for depositing, unstaking, or harvesting rewards.
 */
export class FarmsStakedPosition extends Caller {
	/**
	 * The timestamp (in ms) when rewards were last harvested for this position, possibly overriding the
	 * on-chain data if provided in the constructor.
	 */
	public readonly trueLastHarvestRewardsTimestamp: Timestamp;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a `FarmsStakedPosition` instance for a user's staked position in a farm.
	 *
	 * @param stakedPosition - The on-chain data object representing the user's staked position.
	 * @param trueLastHarvestRewardsTimestamp - Optionally overrides the last harvest time from the on-chain data.
	 * @param config - Optional configuration for the underlying `Caller`.
	 * @param Provider - Optional `AftermathApi` instance for transaction building.
	 */
	constructor(
		public stakedPosition: FarmsStakedPositionObject,
		trueLastHarvestRewardsTimestamp: Timestamp | undefined = undefined,
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "farms");
		this.stakedPosition = stakedPosition;
		this.trueLastHarvestRewardsTimestamp =
			trueLastHarvestRewardsTimestamp ??
			stakedPosition.lastHarvestRewardsTimestamp;
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Getters
	// =========================================================================

	/**
	 * Returns the version of the farm system that this position belongs to (1 or 2).
	 */
	public version = (): FarmsVersion => {
		return this.stakedPosition.version;
	};

	/**
	 * Checks whether the position is still locked, based on the current time and the lock parameters.
	 *
	 * @param inputs - Contains a `FarmsStakingPool` instance to check for system constraints.
	 * @returns `true` if the position is locked; otherwise, `false`.
	 */
	public isLocked = (inputs: { stakingPool: FarmsStakingPool }): boolean => {
		return !this.isUnlocked(inputs);
	};

	/**
	 * Checks whether the position has a non-zero lock duration.
	 *
	 * @returns `true` if the position was created with a lock duration > 0.
	 */
	public isLockDuration = (): boolean => {
		return this.stakedPosition.lockDurationMs > 0;
	};

	/**
	 * Computes the timestamp (in ms) at which this position's lock will end.
	 *
	 * @returns The unlock timestamp (lock start + lock duration).
	 */
	public unlockTimestamp = (): number => {
		return (
			this.stakedPosition.lockStartTimestamp +
			this.stakedPosition.lockDurationMs
		);
	};

	/**
	 * Computes the user's accrued rewards for each reward coin in this position,
	 * returned as a `CoinsToBalance` object keyed by coin type.
	 *
	 * @param inputs - Contains a reference to the `FarmsStakingPool`.
	 * @returns A mapping from `coinType` to the amount of earned rewards.
	 */
	public rewardCoinsToClaimableBalance = (inputs: {
		stakingPool: FarmsStakingPool;
	}): CoinsToBalance => {
		return this.stakedPosition.rewardCoins.reduce(
			(acc, coin) => ({
				...acc,
				[coin.coinType]: this.rewardsEarned({
					...inputs,
					coinType: coin.coinType,
				}),
			}),
			{} as CoinsToBalance
		);
	};

	/**
	 * Lists all reward coin types associated with this position.
	 *
	 * @returns An array of `CoinType` strings representing the reward coins.
	 */
	public rewardCoinTypes = (): CoinType[] => {
		return this.stakedPosition.rewardCoins.map((coin) => coin.coinType);
	};

	/**
	 * Returns only the reward coin types that currently have a non-zero claimable balance.
	 *
	 * @param inputs - Contains a reference to the `FarmsStakingPool`.
	 * @returns An array of `CoinType` strings that have pending rewards > 0.
	 */
	public nonZeroRewardCoinTypes = (inputs: {
		stakingPool: FarmsStakingPool;
	}): CoinType[] => {
		return Object.entries(this.rewardCoinsToClaimableBalance(inputs))
			.filter(([, val]) => val > BigInt(0))
			.map(([key]) => key);
	};

	/**
	 * Retrieves the reward coin record for a specific coin type in this position.
	 *
	 * @param inputs - Must contain a `coinType` string to look up.
	 * @throws If the coin type is not found in this position.
	 * @returns The reward coin object from the position.
	 */
	public rewardCoin = (inputs: { coinType: CoinType }) => {
		const foundCoin = this.stakedPosition.rewardCoins.find(
			(coin) => coin.coinType === inputs.coinType
		);
		if (!foundCoin) throw new Error("Invalid coin type");

		return foundCoin;
	};

	/**
	 * Checks if this position has any claimable rewards across all reward coin types.
	 *
	 * @param inputs - Contains a reference to the `FarmsStakingPool`.
	 * @returns `true` if there are unclaimed rewards; otherwise, `false`.
	 */
	public hasClaimableRewards = (inputs: {
		stakingPool: FarmsStakingPool;
	}): boolean => {
		const { stakingPool } = inputs;

		return (
			Helpers.sumBigInt(
				this.rewardCoinTypes().map((coinType) =>
					this.rewardsEarned({
						coinType,
						stakingPool,
					})
				)
			) > BigInt(0)
		);
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the current amount of earned rewards for a specific coin type,
	 * factoring in any emission constraints and the pool's actual reward availability.
	 *
	 * @param inputs - Contains the `coinType` to check and a reference to the `FarmsStakingPool`.
	 * @returns The total `BigInt` amount of rewards earned for the specified coin type.
	 */
	public rewardsEarned = (inputs: {
		coinType: CoinType;
		stakingPool: FarmsStakingPool;
	}): Balance => {
		if (inputs.stakingPool.rewardCoin(inputs).actualRewards === BigInt(0))
			return BigInt(0);

		this.updatePosition(inputs);

		const rewardCoin = this.rewardCoin(inputs);
		const totalRewards =
			rewardCoin.multiplierRewardsAccumulated +
			rewardCoin.baseRewardsAccumulated;

		// If below the minimum threshold to claim, show 0. If the total rewards
		// exceed what's actually in the pool, we clamp it to 0 or a logic fallback.
		if (totalRewards < Farms.constants.minRewardsToClaim) {
			return BigInt(0);
		}

		// Additional clamp to handle overshoot beyond actual pool reserves
		return totalRewards >
			inputs.stakingPool.rewardCoin(inputs).actualRewards
			? BigInt(0)
			: totalRewards;
	};

	/**
	 * Updates the position's reward calculations based on the pool's current
	 * emission state, effectively "syncing" the on-chain logic into this local
	 * representation. Also checks if the lock duration has elapsed.
	 *
	 * @param inputs - Contains a reference to the `FarmsStakingPool`.
	 * @remarks This method is typically called before computing `rewardsEarned()`.
	 */
	public updatePosition = (inputs: { stakingPool: FarmsStakingPool }) => {
		const stakingPool = new FarmsStakingPool(
			Helpers.deepCopy(inputs.stakingPool.stakingPool),
			this.config
		);

		// If the lock multiplier is valid, proceed. If not, adjust the staked position
		// to the pool's maximum allowed lock multiplier or duration.
		if (
			this.stakedPosition.lockDurationMs <=
				stakingPool.stakingPool.maxLockDurationMs &&
			this.stakedPosition.lockMultiplier <=
				stakingPool.stakingPool.maxLockMultiplier
		) {
			// Lock multiplier is valid; do nothing special
		} else {
			// The position's lock duration or multiplier exceeds the pool's max allowed -> clamp
			stakingPool.stakingPool.stakedAmountWithMultiplier -=
				this.stakedPosition.stakedAmountWithMultiplier;

			// ii. Update the `lock_duration` and `lock_multiplier` related fields.
			this.stakedPosition.lockDurationMs =
				stakingPool.stakingPool.maxLockDurationMs;
			this.stakedPosition.lockMultiplier =
				stakingPool.stakingPool.maxLockMultiplier;

			this.stakedPosition.stakedAmountWithMultiplier =
				(this.stakedPosition.stakedAmount *
					(this.stakedPosition.lockMultiplier -
						FixedUtils.fixedOneB)) /
				FixedUtils.fixedOneB;

			this.stakedPosition.rewardCoins = [
				...this.stakedPosition.rewardCoins.map((rewardCoin) => {
					const currentDebtPerShare = stakingPool.rewardCoin({
						coinType: rewardCoin.coinType,
					}).rewardsAccumulatedPerShare;
					return {
						...rewardCoin,
						multiplierRewardsDebt:
							(this.stakedPosition.stakedAmountWithMultiplier *
								currentDebtPerShare) /
							FixedUtils.fixedOneB,
					};
				}),
			];

			// iii. Increase the `Vault`'s `total_staked_amount_with_multiplier` to account for the
			//  positions new lock multiplier.
			stakingPool.stakingPool.stakedAmountWithMultiplier +=
				this.stakedPosition.stakedAmountWithMultiplier;
		}

		const currentTimestamp = dayjs().valueOf();
		// Accumulate any newly emitted rewards in the pool’s state
		stakingPool.emitRewards();

		// Update position’s base + multiplier rewards using the updated pool info
		for (const [
			rewardCoinIndex,
			rewardCoin,
		] of stakingPool.stakingPool.rewardCoins.entries()) {
			//******************************************************************************************//
			//                      debt (i.e. total_rewards_from_time_t0_to_th-1)                      //
			// .--- pending_rewards_at_time_th_minus_1 ---|                                             //
			// |------------------------------------------+-------------------------------------------| //
			// t0                                        th-1                                       now //
			// '----------------------------- total_rewards_from_time_t0 -----------------------------' //
			//******************************************************************************************//

			// NOTE: new reward types might have been added to the vault since this position last called
			//  `update_ pending_rewards`, so we need to be cautious when borrowing from `rewards_debt`
			//  and `rewards_accumulated`.
			//
			if (rewardCoinIndex >= this.stakedPosition.rewardCoins.length) {
				this.stakedPosition.rewardCoins.push({
					coinType: rewardCoin.coinType,
					baseRewardsAccumulated: BigInt(0),
					baseRewardsDebt: BigInt(0),
					multiplierRewardsAccumulated: BigInt(0),
					multiplierRewardsDebt: BigInt(0),
				});
			}

			const stakedPositionRewardCoin =
				this.stakedPosition.rewardCoins[rewardCoinIndex];

			const [
				totalBaseRewardsFromTimeT0,
				totalMultiplierRewardsFromTimeT0,
			] = this.calcTotalRewardsFromTimeT0({
				rewardsAccumulatedPerShare:
					rewardCoin.rewardsAccumulatedPerShare,
				multiplierRewardsDebt:
					stakedPositionRewardCoin.multiplierRewardsDebt,
				emissionEndTimestamp:
					stakingPool.stakingPool.emissionEndTimestamp,
			});

			// Add newly accrued rewards since the last update
			this.stakedPosition.rewardCoins[
				rewardCoinIndex
			].baseRewardsAccumulated =
				totalBaseRewardsFromTimeT0 -
				stakedPositionRewardCoin.baseRewardsDebt +
				stakedPositionRewardCoin.baseRewardsAccumulated;

			this.stakedPosition.rewardCoins[
				rewardCoinIndex
			].multiplierRewardsAccumulated =
				totalMultiplierRewardsFromTimeT0 -
				stakedPositionRewardCoin.multiplierRewardsDebt +
				stakedPositionRewardCoin.multiplierRewardsAccumulated;

			// Update debts to the new total from time t0
			this.stakedPosition.rewardCoins[rewardCoinIndex].baseRewardsDebt =
				totalBaseRewardsFromTimeT0;

			this.stakedPosition.rewardCoins[
				rewardCoinIndex
			].multiplierRewardsDebt = totalMultiplierRewardsFromTimeT0;
		}

		// Check if this position’s lock has expired
		if (this.unlockTimestamp() < currentTimestamp) {
			this.unlock();
		}

		// this.stakedPosition.lastHarvestRewardsTimestamp = currentTimestamp;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	/**
	 * Builds a transaction to deposit additional principal into this staked position.
	 *
	 * @param inputs - Contains `depositAmount`, the `walletAddress` performing the deposit, and optional sponsorship.
	 * @returns A transaction object (or bytes) that can be signed and executed to increase stake.
	 */
	public async getDepositPrincipalTransaction(inputs: {
		depositAmount: Balance;
		walletAddress: SuiAddress;
		isSponsoredTx?: boolean;
	}) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.useProvider().fetchBuildDepositPrincipalTxV1(args)
			: this.useProvider().fetchBuildDepositPrincipalTxV2(args);
	}

	/**
	 * Builds a transaction to unstake this entire position, optionally claiming SUI as afSUI.
	 *
	 * @param inputs - Contains `walletAddress`, the `FarmsStakingPool` reference, and optional `claimSuiAsAfSui`.
	 * @returns A transaction that can be signed and executed to fully withdraw principal and possibly rewards.
	 */
	public async getUnstakeTransaction(inputs: {
		walletAddress: SuiAddress;
		stakingPool: FarmsStakingPool;
		claimSuiAsAfSui?: boolean;
	}) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			withdrawAmount: this.stakedPosition.stakedAmount,
			rewardCoinTypes: this.nonZeroRewardCoinTypes(inputs),
		};
		return this.version() === 1
			? this.useProvider().fetchBuildUnstakeTxV1(args)
			: this.useProvider().fetchBuildUnstakeTxV2(args);
	}

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	/**
	 * Builds a transaction to lock this position for a specified duration, increasing its lock multiplier (if any).
	 *
	 * @param inputs - Contains the `lockDurationMs` and the `walletAddress`.
	 * @returns A transaction that can be signed and executed to lock the position.
	 */
	public async getLockTransaction(inputs: {
		lockDurationMs: Timestamp;
		walletAddress: SuiAddress;
	}) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.useProvider().buildLockTxV1(args)
			: this.useProvider().buildLockTxV2(args);
	}

	/**
	 * Builds a transaction to re-lock this position (renew lock duration) at the current multiplier.
	 *
	 * @param inputs - Contains the `walletAddress`.
	 * @returns A transaction that can be signed and executed to extend or refresh the lock.
	 */
	public async getRenewLockTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.useProvider().buildRenewLockTxV1(args)
			: this.useProvider().buildRenewLockTxV2(args);
	}

	/**
	 * Builds a transaction to unlock this position, removing any lock-based multiplier.
	 *
	 * @param inputs - Contains the `walletAddress`.
	 * @returns A transaction that can be signed and executed to unlock the position immediately.
	 */
	public async getUnlockTransaction(inputs: { walletAddress: SuiAddress }) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.useProvider().buildUnlockTxV1(args)
			: this.useProvider().buildUnlockTxV2(args);
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	/**
	 * Builds a transaction to harvest (claim) the rewards from this position,
	 * optionally receiving SUI as afSUI.
	 *
	 * @param inputs - Includes the `walletAddress`, the `FarmsStakingPool`, and optional `claimSuiAsAfSui`.
	 * @returns A transaction that can be signed and executed to claim accrued rewards.
	 */
	public async getHarvestRewardsTransaction(inputs: {
		walletAddress: SuiAddress;
		stakingPool: FarmsStakingPool;
		claimSuiAsAfSui?: boolean;
	}) {
		const args = {
			...inputs,
			stakedPositionIds: [this.stakedPosition.objectId],
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			rewardCoinTypes: this.nonZeroRewardCoinTypes(inputs),
		};
		return this.version() === 1
			? this.useProvider().fetchBuildHarvestRewardsTxV1(args)
			: this.useProvider().fetchBuildHarvestRewardsTxV2(args);
	}

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the total base + multiplier rewards from time t0 for this position,
	 * ensuring that multiplier rewards only apply during the locked period.
	 *
	 * @param inputs - Contains updated `rewardsAccumulatedPerShare`, the position’s `multiplierRewardsDebt`, and the pool’s `emissionEndTimestamp`.
	 * @returns A tuple `[baseRewards, multiplierRewards]`.
	 */
	private calcTotalRewardsFromTimeT0(inputs: {
		rewardsAccumulatedPerShare: Balance;
		multiplierRewardsDebt: Balance;
		emissionEndTimestamp: Timestamp;
	}): [Balance, Balance] {
		const {
			rewardsAccumulatedPerShare,
			multiplierRewardsDebt,
			emissionEndTimestamp,
		} = inputs;

		const lastRewardTimestamp =
			this.stakedPosition.lastHarvestRewardsTimestamp;
		const lockEndTimestamp = this.unlockTimestamp();

		const principalStakedAmount = this.stakedPosition.stakedAmount;
		const baseRewards =
			(principalStakedAmount * rewardsAccumulatedPerShare) /
			FixedUtils.fixedOneB;

		// const totalMultiplierRewards =
		// 	(this.stakedPosition.stakedAmountWithMultiplier *
		// 		rewardsAccumulatedPerShare) /
		// 	FixedUtils.fixedOneB;

		const multiplierEndTimestamp = Math.min(
			lockEndTimestamp,
			emissionEndTimestamp
		);

		const multiplierRewards = (() => {
			if (lastRewardTimestamp <= multiplierEndTimestamp) {
				return (
					(rewardsAccumulatedPerShare *
						this.stakedPosition.stakedAmountWithMultiplier) /
					FixedUtils.fixedOneB
				);
			} else {
				return multiplierRewardsDebt;
			}
		})();

		return [baseRewards, multiplierRewards];
	}

	/**
	 * Removes the lock multiplier from this position if the current time is beyond the lock duration,
	 * reverting `lockMultiplier` to 1.0 (fixedOneB).
	 */
	private unlock = () => {
		// ia. Remove position's `multiplier_staked_amount` from the pool.
		// afterburner_vault::decrease_stake_with_multiplier(vault, self.multiplier_staked_amount);
		this.stakedPosition.stakedAmountWithMultiplier = BigInt(0);

		// ib. Reset position's lock parameters.
		this.stakedPosition.lockDurationMs = 0;
		this.stakedPosition.lockMultiplier = FixedUtils.fixedOneB;
	};

	/**
	 * Determines if this position is unlocked based on the lock end timestamp, the emission end timestamp,
	 * or a forced unlock condition in the pool.
	 */
	private isUnlocked = (inputs: {
		stakingPool: FarmsStakingPool;
	}): boolean => {
		const { stakingPool } = inputs;
		const currentTime = dayjs().valueOf();

		// If lock has expired, the emission has ended, or the pool is forcibly unlocked, then it is unlocked
		return (
			this.unlockTimestamp() <= currentTime ||
			stakingPool.stakingPool.emissionEndTimestamp <= currentTime ||
			stakingPool.stakingPool.isUnlocked
		);
	};

	/**
	 * Provides access to the `Farms` provider in the `AftermathApi`.
	 */
	private useProvider = () => {
		const provider = this.Provider?.Farms();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}
