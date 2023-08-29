import { SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsDepositPrincipalBody,
	ApiFarmsLockBody,
	ApiFarmsRenewLockBody,
	ApiFarmsUnlockBody,
	ApiFarmsUnstakeBody,
	ApiHarvestFarmsRewardsBody,
	Apy,
	Balance,
	CoinType,
	CoinsToBalance,
	FarmsStakedPositionObject,
	SuiNetwork,
	Timestamp,
	Url,
} from "../../types";
import { FarmsStakingPool } from "./farmsStakingPool";
import { Fixed } from "../../general/utils/fixed";
import { Helpers } from "../../general/utils";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

export class FarmsStakedPosition extends Caller {
	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly trueLastHarvestRewardsTimestamp: Timestamp;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public stakedPosition: FarmsStakedPositionObject,
		trueLastHarvestRewardsTimestamp?: Timestamp,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, "farms");
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

	public isLocked = (): boolean => {
		const nowTimestamp = dayjs().valueOf();
		return this.unlockTimestamp() > nowTimestamp;
	};

	public isLockDuration = (): boolean => {
		return this.stakedPosition.lockDurationMs > 0;
	};

	public unlockTimestamp = (): number => {
		return (
			this.stakedPosition.lockStartTimestamp +
			this.stakedPosition.lockDurationMs
		);
	};

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

	public rewardCoinTypes = (): CoinType[] => {
		return this.stakedPosition.rewardCoins.map((coin) => coin.coinType);
	};

	public nonZeroRewardCoinTypes = (inputs: {
		stakingPool: FarmsStakingPool;
	}): CoinType[] => {
		return Object.entries(this.rewardCoinsToClaimableBalance(inputs))
			.filter(([, val]) => val >= BigInt(0))
			.map(([key]) => key);
	};

	public rewardCoin = (inputs: { coinType: CoinType }) => {
		const foundCoin = this.stakedPosition.rewardCoins.find(
			(coin) => coin.coinType === inputs.coinType
		);
		if (!foundCoin) throw new Error("Invalid coin type");

		return foundCoin;
	};

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

	public rewardsEarned = (inputs: {
		coinType: CoinType;
		stakingPool: FarmsStakingPool;
	}) => {
		this.updatePosition(inputs);

		const rewardCoin = this.rewardCoin(inputs);
		return (
			rewardCoin.multiplierRewardsAccumulated +
			rewardCoin.baseRewardsAccumulated
		);
	};

	// Updates the amount of rewards that can be harvested from `self` + the position's
	// debt. If the position's lock duration has elapsed, it will be unlocked.
	public updatePosition = (inputs: { stakingPool: FarmsStakingPool }) => {
		const currentTimestamp = dayjs().valueOf();
		if (this.stakedPosition.lastHarvestRewardsTimestamp >= currentTimestamp)
			return;

		// i. Increase the vault's `rewardsAccumulatedPerShare` values.
		const stakingPool = new FarmsStakingPool(
			Helpers.deepCopy(inputs.stakingPool.stakingPool)
		);
		stakingPool.emitRewards();

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

			// NOTE: `total_rewards_from_time_t0` contains the amount of rewards a position would receive
			//  -- from time t0 to the current time -- given the vault's current state when, in reality,
			//  we need to calculate just the rewards that have accumulated since the last time the
			//  position's `rewards_accumulated` was updated [labeled time th-1].
			//
			let [totalBaseRewardsFromTimeT0, totalMultiplierRewardsFromTimeT0] =
				this.calcTotalRewardsFromTimeT0({
					rewardsAccumulatedPerShare:
						rewardCoin.rewardsAccumulatedPerShare,
					multiplierRewardsDebt:
						stakedPositionRewardCoin.multiplierRewardsDebt,
				});

			totalMultiplierRewardsFromTimeT0 +=
				stakedPositionRewardCoin.multiplierRewardsDebt;

			// calc_total_rewards_from_time_t0 returns 0 for multiplier rewards only if and only if the position was
			// not locked since the last harvest. in such a case 0 does not mean 0 rewards but the initial state before
			// the position was opened. thus, assigning debt here.
			// if (totalMultiplierRewardsFromTimeT0 === BigInt(0)) {
			// 	totalMultiplierRewardsFromTimeT0 =
			// 		stakedPositionRewardCoin.multiplierRewardsDebt;
			// }

			// NOTE: Every time a position's `rewards_accumulated` is updated, a snapshot of the total
			//  rewards received from time t0 is taken and stored as the position's `debt` field. Here,
			//  the debt is subtracted from `total_rewards_from_time_t0` in order to calculate the amount
			//  of rewards that have been accumulated since the last time `rewards_accumulated` was
			//  updated.
			//
			//  `pending_rewards_at_time_th_minus_1` is added to the resulting value to account for all
			//  rewards that had accumulated up until the last time `update_position` was updated.
			//
			// iia. Allocate rewards to this position that have been emitted since the last time this
			//  function was called.
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

			// iib. Set the position's current debt to the total rewards attributed to this position given
			//  the vault's current state. This allows the next `update_position` call to disregard
			//  all rewards accumulated up until this point -- preventing double emission cases.
			this.stakedPosition.rewardCoins[rewardCoinIndex].baseRewardsDebt =
				totalBaseRewardsFromTimeT0;
			this.stakedPosition.rewardCoins[
				rewardCoinIndex
			].multiplierRewardsDebt = totalMultiplierRewardsFromTimeT0;
		}

		// iii. Remove the position's lock multiplier + bonus staked amount if the position is no
		//  longer locked.
		if (this.unlockTimestamp() < currentTimestamp) {
			// TODO: handle unlock
			this.unlock();
		}

		this.stakedPosition.lastHarvestRewardsTimestamp = currentTimestamp;
	};

	public calcTotalApy = (inputs: {
		rewardsUsd: number;
		stakeUsd: number;
	}): Apy => {
		const { rewardsUsd, stakeUsd } = inputs;

		dayjs.extend(duration);
		const oneYearMs = dayjs.duration(1, "year").asMilliseconds();
		const timeSinceLastHarvestMs =
			dayjs().valueOf() - this.trueLastHarvestRewardsTimestamp;

		const rewardsUsdOneYear =
			timeSinceLastHarvestMs > 0
				? rewardsUsd * (oneYearMs / timeSinceLastHarvestMs)
				: 0;

		const apy = stakeUsd > 0 ? rewardsUsdOneYear / stakeUsd : 0;
		return apy;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	public async getDepositPrincipalTransaction(inputs: {
		depositAmount: Balance;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsDepositPrincipalBody>(
			"transactions/deposit-principal",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			}
		);
	}

	public async getUnstakeTransaction(inputs: {
		walletAddress: SuiAddress;
		stakingPool: FarmsStakingPool;
	}) {
		return this.fetchApiTransaction<ApiFarmsUnstakeBody>(
			"transactions/unstake",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
				withdrawAmount: this.stakedPosition.stakedAmount,
				rewardCoinTypes: this.nonZeroRewardCoinTypes(inputs),
			}
		);
	}

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	public async getLockTransaction(inputs: {
		lockDurationMs: Timestamp;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsLockBody>("transactions/lock", {
			...inputs,
			stakedPositionId: this.stakedPosition.objectId,
			stakeCoinType: this.stakedPosition.stakeCoinType,
			stakingPoolId: this.stakedPosition.stakingPoolObjectId,
		});
	}

	public async getRenewLockTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsRenewLockBody>(
			"transactions/renew-lock",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			}
		);
	}

	public async getUnlockTransaction(inputs: { walletAddress: SuiAddress }) {
		return this.fetchApiTransaction<ApiFarmsUnlockBody>(
			"transactions/unlock",
			{
				...inputs,
				stakedPositionId: this.stakedPosition.objectId,
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
			}
		);
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	public async getHarvestRewardsTransaction(inputs: {
		walletAddress: SuiAddress;
		stakingPool: FarmsStakingPool;
	}) {
		return this.fetchApiTransaction<ApiHarvestFarmsRewardsBody>(
			"transactions/harvest-rewards",
			{
				...inputs,
				stakedPositionIds: [this.stakedPosition.objectId],
				stakeCoinType: this.stakedPosition.stakeCoinType,
				stakingPoolId: this.stakedPosition.stakingPoolObjectId,
				rewardCoinTypes: this.nonZeroRewardCoinTypes(inputs),
			}
		);
	}

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	// Calculates a position's accrued rewards [from time t0] given a vault's
	//  `rewardsAccumulatedPerShare`. If the position is beyond its lock duration, we need to only
	//  apply the lock multiplier rewards to the time spent locked.
	public calcTotalRewardsFromTimeT0(inputs: {
		rewardsAccumulatedPerShare: Balance;
		multiplierRewardsDebt: Balance;
	}): [Balance, Balance] {
		const { rewardsAccumulatedPerShare, multiplierRewardsDebt } = inputs;

		const currentTimestamp = dayjs().valueOf();
		const lockEndTimestamp = this.unlockTimestamp();
		const lastRewardTimestamp =
			this.stakedPosition.lastHarvestRewardsTimestamp;

		const principalStakedAmount = this.stakedPosition.stakedAmount;
		// Base [e.g. principal] staked amount receives full (unaltered) rewards.
		const rewardsAttributedToPrincipal =
			principalStakedAmount *
			(rewardsAccumulatedPerShare / Fixed.fixedOneB);

		// The position should only receive multiplied rewards for the time that was spent locked since
		//  the last harvest. This case occurs when the user calls `pending_rewards` after the position's
		//  lock duration has expired.
		const rewardsAttributedToLockMultiplier = (() => {
			return currentTimestamp <= lockEndTimestamp
				? this.stakedPosition.stakedAmountWithMultiplier *
						(rewardsAccumulatedPerShare / Fixed.fixedOneB) -
						multiplierRewardsDebt
				: lockEndTimestamp <= lastRewardTimestamp
				? // Short circuit in the case the position hasn't been locked since the last harvest. Also
				  //  required to not error on `lockEndTimestamp - lastRewardTimestamp`.
				  BigInt(0)
				: (() => {
						// Multiplier staked amount receives (altered) rewards dependent on the total time the
						//  position was locked since the last harvest.
						const totalRewardsAttributedToLockMultiplier =
							this.stakedPosition.stakedAmountWithMultiplier *
							(rewardsAccumulatedPerShare / Fixed.fixedOneB);

						const timeSinceLastHarvest =
							currentTimestamp - lastRewardTimestamp;
						const timeSpentLockedSinceLastHarvestMs =
							lockEndTimestamp - lastRewardTimestamp;

						// ********************************************************************************************//
						//  / timeSpentLockedSinceLastHarvestMs \                                                //
						// | ----------------------------------------- | x totalRewardsAttributedToLockMultiplier //
						//  \       timeSinceLastHarvest        /                                                //
						// ********************************************************************************************//

						// Only disperse the multiplied rewards that were received while this position was locked.
						return (
							totalRewardsAttributedToLockMultiplier *
							(BigInt(
								Math.floor(timeSpentLockedSinceLastHarvestMs)
							) /
								BigInt(Math.floor(timeSinceLastHarvest)))
						);
				  })();
		})();

		return [
			rewardsAttributedToPrincipal,
			rewardsAttributedToLockMultiplier,
		];
	}

	// Removes a positions `lock_duration_ms` and `lock_multiplier`. Updates the vault's
	//  `staked_amount_with_multiplier` to account for the lost `lock_multiplier`.
	private unlock = () => {
		this.stakedPosition.lockDurationMs = 0;
		this.stakedPosition.lockMultiplier = BigInt(0);
	};
}
