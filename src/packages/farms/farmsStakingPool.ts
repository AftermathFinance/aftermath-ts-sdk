import { Balance, CoinType, SuiNetwork, Timestamp, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsIncreaseStakingPoolRewardsEmissionsBody,
	ApiFarmsInitializeStakingPoolRewardBody,
	ApiFarmsStakeBody,
	ApiFarmsTopUpStakingPoolRewardsBody,
	ApiHarvestFarmsRewardsBody,
	FarmsStakingPoolObject,
} from "./farmsTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Helpers } from "../../general/utils";

export class FarmsStakingPool extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public stakingPool: FarmsStakingPoolObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, "farms");
		this.stakingPool = stakingPool;
		this.emitRewards();
	}

	// =========================================================================
	//  Public
	// =========================================================================

	// =========================================================================
	//  Getters
	// =========================================================================

	public rewardCoinTypes = (): CoinType[] => {
		return this.stakingPool.rewardCoins.map((coin) => coin.coinType);
	};

	public rewardCoin = (inputs: { coinType: CoinType }) => {
		const foundCoin = this.stakingPool.rewardCoins.find(
			(coin) => coin.coinType === inputs.coinType
		);
		if (!foundCoin) throw new Error("Invalid coin type");

		return foundCoin;
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	// Calculates the amount of rewards that have emitted since the last time this function has been
	// called. Updates `rewards_accumulated_per_share`.
	public emitRewards = () => {
		const currentTimestamp = Date.now();

		// ia. Check that the vault has deposits.
		if (this.stakingPool.stakedAmount === BigInt(0)) return;

		const rewardCoins = Helpers.deepCopy(this.stakingPool.rewardCoins);
		for (const [rewardCoinIndex, rewardCoin] of rewardCoins.entries()) {
			// ib. Check that enough time has passed since the last emission.
			if (
				currentTimestamp <
				rewardCoin.lastRewardTimestamp + rewardCoin.emissionSchedulesMs
			)
				continue;

			// ii. Calculate how many rewards have to be emitted.
			const number_of_emissions =
				(currentTimestamp - rewardCoin.lastRewardTimestamp) /
				rewardCoin.emissionSchedulesMs;

			const rewardsToEmit =
				rewardCoin.emissionRate *
				BigInt(Math.floor(number_of_emissions));

			// iii. Increase the amount of rewards emitted per share.
			this.increaseRewardsAccumulatedPerShare({
				rewardsToEmit,
				rewardCoinIndex,
			});

			// iv. Update reward's `last_reward_timestamp`.
			this.stakingPool.rewardCoins[rewardCoinIndex].lastRewardTimestamp =
				rewardCoin.lastRewardTimestamp +
				number_of_emissions * rewardCoin.emissionSchedulesMs;
		}
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	public async getStakeTransaction(inputs: {
		stakeAmount: Balance;
		lockDurationMs: Timestamp;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsStakeBody>(
			"transactions/stake",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	public async getHarvestRewardsTransaction(inputs: {
		stakedPositionIds: ObjectId[];
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiHarvestFarmsRewardsBody>(
			"transactions/harvest-rewards",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
				rewardCoinTypes: this.rewardCoinTypes(),
			}
		);
	}

	// =========================================================================
	//  Mutation Transactions (Owner Only)
	// =========================================================================

	public async getInitializeRewardTransaction(inputs: {
		ownerCapId: ObjectId;
		rewardAmount: Balance;
		emissionScheduleMs: Timestamp;
		emissionRate: bigint;
		emissionDelayTimestampMs: Timestamp;
		rewardCoinType: CoinType;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsInitializeStakingPoolRewardBody>(
			"transactions/initialize-reward",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}

	public async getTopUpRewardsTransaction(inputs: {
		ownerCapId: ObjectId;
		rewards: {
			rewardAmount: Balance;
			rewardCoinType: CoinType;
		}[];
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsTopUpStakingPoolRewardsBody>(
			"transactions/top-up-reward",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}

	public async getIncreaseRewardsEmissionsTransaction(inputs: {
		ownerCapId: ObjectId;
		rewards: {
			rewardCoinType: CoinType;
			emissionScheduleMs: Timestamp;
			emissionRate: bigint;
		}[];
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsIncreaseStakingPoolRewardsEmissionsBody>(
			"transactions/increase-reward-emissions",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	private increaseRewardsAccumulatedPerShare(inputs: {
		rewardsToEmit: Balance;
		rewardCoinIndex: number;
	}) {
		const { rewardsToEmit, rewardCoinIndex } = inputs;

		// i. Calculate the pro-rata amount of rewards allocated to each staked amount.
		const newRewardsAccumulatedPerShare =
			(rewardsToEmit * BigInt(1_000_000_000_000_000_000)) /
			this.stakingPool.stakedAmountWithMultiplier;

		if (newRewardsAccumulatedPerShare === BigInt(0)) return;

		// ii. Increase the amount of rewards emitted per share.
		const rewards_accumulated_per_share =
			this.stakingPool.rewardCoins[rewardCoinIndex]
				.rewardsAccumulatedPerShare;

		this.stakingPool.rewardCoins[
			rewardCoinIndex
		].rewardsAccumulatedPerShare =
			rewards_accumulated_per_share + newRewardsAccumulatedPerShare;
	}
}
