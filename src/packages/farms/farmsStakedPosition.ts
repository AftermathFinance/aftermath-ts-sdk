import type { AftermathApi } from "../../general/providers";
import { Helpers } from "../../general/utils";
import { Caller } from "../../general/utils/caller";
import { FixedUtils } from "../../general/utils/fixedUtils";
import type {
	Balance,
	CallerConfig,
	CoinsToBalance,
	CoinType,
	FarmsStakedPositionObject,
	FarmsVersion,
	SuiAddress,
	Timestamp,
} from "../../types";
import { Farms } from "./farms";
import { FarmsStakingPool } from "./farmsStakingPool";

/**
 * A local view of one user's staked position.
 *
 * The class exposes lock state, reward accounting, and version-aware builders
 * for depositing, withdrawing, locking, unlocking, unstaking, and harvesting.
 * Reward and lock calculations use the supplied pool view and do not fetch
 * fresh data. Transaction builders require an `AftermathApi` provider and
 * return unsigned transaction data.
 */
export class FarmsStakedPosition extends Caller {
	/**
	 * The reward timestamp supplied by the constructor, or the position's stored
	 * last-harvest timestamp when no override was supplied.
	 */
	public readonly trueLastHarvestRewardsTimestamp: Timestamp;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a `FarmsStakedPosition` instance from normalized position data.
	 *
	 * @param stakedPosition - Normalized object data for the user's position.
	 * @param trueLastHarvestRewardsTimestamp - Optional timestamp override, in milliseconds.
	 * @param config - Optional network and API-host configuration.
	 * @param api - Optional provider required by transaction builders.
	 */
	constructor(
		public stakedPosition: FarmsStakedPositionObject,
		trueLastHarvestRewardsTimestamp: Timestamp | undefined = undefined,
		config?: CallerConfig,
		public readonly api?: AftermathApi
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
	 * Returns the farm contract version that produced this position.
	 */
	public version = (): FarmsVersion => {
		return this.stakedPosition.version;
	};

	/**
	 * Checks whether the position is currently locked for this pool.
	 *
	 * The result is false when the lock has expired, the pool's emission period
	 * has ended, or the pool is forcibly open. It uses `Date.now()` and does not
	 * perform a network read.
	 *
	 * @param inputs - Pool view used for emission-end and forced-unlock rules.
	 * @returns `true` if the position is locked; otherwise, `false`.
	 */
	public isLocked = (inputs: { stakingPool: FarmsStakingPool }): boolean => {
		return !this.isUnlocked(inputs);
	};

	/**
	 * Checks whether the position is locked under strict pool enforcement.
	 *
	 * @param inputs - Contains a `FarmsStakingPool` instance to check lock state and enforcement.
	 * @returns `true` if locked with strict enforcement; otherwise, `false`.
	 */
	public isStrictlyLocked = (inputs: {
		stakingPool: FarmsStakingPool;
	}): boolean => {
		const { stakingPool } = inputs;
		return (
			this.isLocked({ stakingPool }) && stakingPool.isStrictLockEnforcement()
		);
	};

	/**
	 * Checks whether the position is locked under relaxed pool enforcement.
	 *
	 * @param inputs - Contains a `FarmsStakingPool` instance to check lock state and enforcement.
	 * @returns `true` if locked with relaxed enforcement; otherwise, `false`.
	 */
	public isRelaxedLocked = (inputs: {
		stakingPool: FarmsStakingPool;
	}): boolean => {
		const { stakingPool } = inputs;
		return (
			this.isLocked({ stakingPool }) && stakingPool.isRelaxedLockEnforcement()
		);
	};

	/**
	 * Checks whether the position stores a non-zero lock duration.
	 *
	 * @returns `true` if the position was created with a lock duration > 0.
	 */
	public isLockDuration = (): boolean => {
		return this.stakedPosition.lockDurationMs > 0;
	};

	/**
	 * Computes the timestamp in milliseconds at which this position's lock ends.
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
	 * Computes the claimable amount for each reward coin in this position.
	 *
	 * The returned map uses reward coin types as keys and base-unit `bigint`
	 * amounts as values. It applies the minimum claim threshold and available
	 * pool balance checks used by `rewardsEarned`.
	 *
	 * @param inputs - Pool view used to validate each reward balance.
	 * @returns A mapping from `coinType` to claimable base-unit balance.
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
	 * Returns reward coin types with a positive claimable balance.
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
	 * Retrieves the local reward-accounting record for one coin type.
	 *
	 * @param inputs - Reward coin type to look up.
	 * @throws `Error` with `"Invalid coin type"` when no matching record exists.
	 * @returns The matching reward-accounting record.
	 */
	public rewardCoin = (inputs: { coinType: CoinType }) => {
		const foundCoin = this.stakedPosition.rewardCoins.find(
			(coin) => coin.coinType === inputs.coinType
		);
		if (!foundCoin) {
			throw new Error("Invalid coin type");
		}

		return foundCoin;
	};

	/**
	 * Checks whether this position has any claimable reward amount.
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
	 * Returns the currently claimable amount for one reward coin.
	 *
	 * This local calculation adds base and multiplier rewards. It returns zero
	 * when the pool has no actual balance, the amount is below
	 * `Farms.constants.minRewardsToClaim`, or the amount exceeds the pool's
	 * available balance. It does not call `updatePosition()` automatically.
	 *
	 * @param inputs - Reward coin type and the matching pool view.
	 * @throws `Error` with `"Invalid coin type"` when either object has no matching reward record.
	 * @returns The claimable amount in reward-coin base units.
	 */
	public rewardsEarned = (inputs: {
		coinType: CoinType;
		stakingPool: FarmsStakingPool;
	}): Balance => {
		if (inputs.stakingPool.rewardCoin(inputs).actualRewards === BigInt(0)) {
			return BigInt(0);
		}

		// this.updatePosition(inputs);

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
		return totalRewards > inputs.stakingPool.rewardCoin(inputs).actualRewards
			? BigInt(0)
			: totalRewards;
	};

	/**
	 * Updates this position's local reward accounting from a pool snapshot.
	 *
	 * The method emits completed pool intervals, clamps a stale lock to the
	 * pool's maximum duration and multiplier, adds reward records introduced by
	 * the pool, updates reward debts, and records the current timestamp. It does
	 * not fetch from the network and does not automatically call the on-chain
	 * unlock operation when the lock expires.
	 *
	 * @param inputs - Pool snapshot used for emission and per-share calculations.
	 * @remarks Call this method before `rewardsEarned()` when the local position data is stale.
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
					(this.stakedPosition.lockMultiplier - FixedUtils.fixedOneB)) /
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

		const currentTimestamp = Date.now();
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

			const [totalBaseRewardsFromTimeT0, totalMultiplierRewardsFromTimeT0] =
				this.calcTotalRewardsFromTimeT0({
					rewardsAccumulatedPerShare: rewardCoin.rewardsAccumulatedPerShare,
					multiplierRewardsDebt: stakedPositionRewardCoin.multiplierRewardsDebt,
					emissionEndTimestamp: stakingPool.stakingPool.emissionEndTimestamp,
				});

			// Add newly accrued rewards since the last update
			this.stakedPosition.rewardCoins[rewardCoinIndex].baseRewardsAccumulated =
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

			this.stakedPosition.rewardCoins[rewardCoinIndex].multiplierRewardsDebt =
				totalMultiplierRewardsFromTimeT0;
		}

		// Check if this position’s lock has expired
		// if (this.unlockTimestamp() < currentTimestamp) {
		// 	this.unlock();
		// }

		this.stakedPosition.lastHarvestRewardsTimestamp = currentTimestamp;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	/**
	 * Builds a version-aware transaction to deposit additional principal.
	 *
	 * The position, pool, and stake coin IDs are taken from this instance. The
	 * amount is in stake-coin base units. The transaction does not submit itself.
	 *
	 * @param inputs - Deposit amount, signing wallet, and optional sponsorship.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
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
			? this.farmsApi().fetchBuildDepositPrincipalTxV1(args)
			: this.farmsApi().fetchBuildDepositPrincipalTxV2(args);
	}

	/**
	 * Builds a version-aware transaction that withdraws this entire position and destroys it.
	 *
	 * The builder includes reward types with a positive claimable balance before
	 * it withdraws principal and appends the destroy command. Strict pools still
	 * require the position to be unlocked when the transaction executes.
	 *
	 * @param inputs - Matching pool view, signing wallet, and optional SUI-to-afSUI claim flag.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
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
			? this.farmsApi().buildUnstakeTxV1(args)
			: this.farmsApi().buildUnstakeTxV2(args);
	}

	/**
	 * Builds a version-aware transaction to withdraw part of the principal.
	 *
	 * Unlike `getUnstakeTransaction`, this operation keeps the position object.
	 * The amount is in stake-coin base units, and the matching pool view is used
	 * by the on-chain validation path.
	 *
	 * @param inputs - Withdraw amount, matching pool view, and signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getWithdrawPrincipalTransaction(inputs: {
		walletAddress: SuiAddress;
		withdrawAmount: Balance;
		stakingPool: FarmsStakingPool;
	}) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.farmsApi().buildWithdrawPrincipalTxV1(args)
			: this.farmsApi().buildWithdrawPrincipalTxV2(args);
	}

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	/**
	 * Builds a version-aware transaction to lock this position for a duration.
	 *
	 * The duration is in milliseconds and is validated against the pool's lock
	 * range when the transaction executes. V1 and V2 builders are selected from
	 * the position version.
	 *
	 * @param inputs - Lock duration and signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
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
			? this.farmsApi().buildLockTxV1(args)
			: this.farmsApi().buildLockTxV2(args);
	}

	/**
	 * Builds a version-aware transaction to renew this position's lock.
	 *
	 * The on-chain command refreshes the lock without accepting a new duration.
	 *
	 * @param inputs - Signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getRenewLockTransaction(inputs: { walletAddress: SuiAddress }) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.farmsApi().buildRenewLockTxV1(args)
			: this.farmsApi().buildRenewLockTxV2(args);
	}

	/**
	 * Builds a version-aware transaction to unlock this position.
	 *
	 * The contract may reject the command while the position is still locked.
	 * Emission end and the pool's forced-open flag are part of the local lock
	 * checks used by the façade, but on-chain validation remains authoritative.
	 *
	 * @param inputs - Signing wallet.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
	 */
	public async getUnlockTransaction(inputs: { walletAddress: SuiAddress }) {
		const args = {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		};
		return this.version() === 1
			? this.farmsApi().buildUnlockTxV1(args)
			: this.farmsApi().buildUnlockTxV2(args);
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	/**
	 * Builds a version-aware transaction to harvest this position's rewards.
	 *
	 * The builder includes only reward types with a positive locally claimable
	 * balance. It can request SUI as afSUI when that option is supported.
	 *
	 * @param inputs - Matching pool view, signing wallet, and optional SUI-to-afSUI claim flag.
	 * @returns An unsigned transaction that can be signed and executed.
	 * @throws An error if no `AftermathApi` instance was provided.
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
			? this.farmsApi().buildHarvestRewardsTxV1(args)
			: this.farmsApi().buildHarvestRewardsTxV2(args);
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

		const lastRewardTimestamp = this.stakedPosition.lastHarvestRewardsTimestamp;
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
			}
			return multiplierRewardsDebt;
		})();

		return [baseRewards, multiplierRewards];
	}

	// /**
	//  * Removes the lock multiplier from this position if the current time is beyond the lock duration,
	//  * reverting `lockMultiplier` to 1.0 (fixedOneB).
	//  */
	// private unlock = () => {
	// 	// ia. Remove position's `multiplier_staked_amount` from the pool.
	// 	// afterburner_vault::decrease_stake_with_multiplier(vault, self.multiplier_staked_amount);
	// 	this.stakedPosition.stakedAmountWithMultiplier = BigInt(0);

	// 	// ib. Reset position's lock parameters.
	// 	this.stakedPosition.lockDurationMs = 0;
	// 	this.stakedPosition.lockMultiplier = FixedUtils.fixedOneB;
	// };

	/**
	 * Determines if this position is unlocked based on the lock end timestamp, the emission end timestamp,
	 * or a forced unlock condition in the pool.
	 */
	private readonly isUnlocked = (inputs: {
		stakingPool: FarmsStakingPool;
	}): boolean => {
		const { stakingPool } = inputs;
		const currentTime = Date.now();

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
	private readonly farmsApi = () => {
		const farms = this.api?.Farms();
		if (!farms) {
			throw new Error("missing AftermathApi instance");
		}
		return farms;
	};
}
