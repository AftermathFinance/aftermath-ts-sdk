import {
	Apy,
	Balance,
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
	ApiFarmsStakeBody,
	ApiFarmsTopUpStakingPoolRewardsBody,
	ApiHarvestFarmsRewardsBody,
	FarmOwnerOrOneTimeAdminCap,
	FarmsMultiplier,
	FarmsStakingPoolObject,
	FarmsStakingPoolRewardCoin,
} from "./farmsTypes";
import { Casting, Helpers } from "../../general/utils";
import { Coin } from "..";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Fixed } from "../../general/utils/fixed";

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
		// this.emitRewards();
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
		const currentTimestamp = dayjs().valueOf();

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

	public calcApy = (inputs: {
		coinType: CoinType;
		price: number;
		decimals: number;
		tvlUsd: number;
	}): Apy => {
		const { coinType, price, decimals, tvlUsd } = inputs;

		if (price <= 0 || tvlUsd <= 0) return 0;

		// this.emitRewards();

		const rewardCoin = this.rewardCoin({ coinType });
		const currentTimestamp = dayjs().valueOf();

		if (
			rewardCoin.emissionStartTimestamp > currentTimestamp ||
			currentTimestamp > this.stakingPool.emissionEndTimestamp
		)
			return 0;

		const emissionRateUsd =
			Coin.balanceWithDecimals(rewardCoin.emissionRate, decimals) * price;

		dayjs.extend(duration);
		const oneYearMs = dayjs.duration(1, "year").asMilliseconds();
		const rewardsUsdOneYear =
			emissionRateUsd * (oneYearMs / rewardCoin.emissionSchedulesMs);

		const apy = rewardsUsdOneYear / tvlUsd;
		return apy < 0 ? 0 : apy;
	};

	public calcTotalApy = (inputs: {
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: CoinsToDecimals;
		tvlUsd: number;
	}): Apy => {
		const { coinsToPrice, coinsToDecimals, tvlUsd } = inputs;

		const apys = this.rewardCoinTypes().map((coinType) =>
			this.calcApy({
				coinType,
				price: coinsToPrice[coinType],
				decimals: coinsToDecimals[coinType],
				tvlUsd,
			})
		);
		return Helpers.sum(apys);
	};

	public calcMultiplier = (inputs: {
		lockDurationMs: number;
	}): FarmsMultiplier => {
		const { lockDurationMs } = inputs;

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
		return multiplier < Fixed.fixedOneB ? Fixed.fixedOneB : multiplier;
	};

	// public calc_emitted_rewards(): bigint[] {
	// 	let emitted_rewards: bigint[] = [];

	// 	let length = this.stakingPool.rewardCoins.length;
	// 	let index = 0;

	// 	while (index < length) {
	// 		let emission_start_timestamp_ms =
	// 			this.stakingPool.rewardCoins[index].emissionStartTimestamp;
	// 		let last_reward_timestamp_ms =
	// 			this.stakingPool.rewardCoins[index].lastRewardTimestamp;

	// 		emitted_rewards.push(
	// 			this.calcRewardsEmittedFromTimeTmToTn({
	// 				timestampTm: emission_start_timestamp_ms,
	// 				timestampTn: last_reward_timestamp_ms,
	// 				rewardCoin: this.stakingPool.rewardCoins[index],
	// 			})
	// 		);

	// 		index = index + 1;
	// 	}

	// 	return emitted_rewards;
	// }

	// public calc_emitted_rewards_for(inputs: {
	// 	rewardCoinIndex: number;
	// }): bigint {
	// 	let reward_index = inputs.rewardCoinIndex;

	// 	let emission_start_timestamp_ms =
	// 		this.stakingPool.rewardCoins[reward_index].emissionStartTimestamp;
	// 	let last_reward_timestamp_ms =
	// 		this.stakingPool.rewardCoins[reward_index].lastRewardTimestamp;

	// 	return this.calcRewardsEmittedFromTimeTmToTn({
	// 		timestampTm: emission_start_timestamp_ms,
	// 		timestampTn: last_reward_timestamp_ms,
	// 		rewardCoin: this.stakingPool.rewardCoins[reward_index],
	// 	});
	// }

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
	//  Mutation/Creation Transactions (Owner Only)
	// =========================================================================

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

	public async getGrantOneTimeAdminCapTransaction(
		inputs: ApiFarmsGrantOneTimeAdminCapBody
	) {
		return this.fetchApiTransaction<ApiFarmsGrantOneTimeAdminCapBody>(
			"transactions/grant-one-time-admin-cap",
			inputs
		);
	}

	// =========================================================================
	//  Mutation Transactions (Owner/Admin Only)
	// =========================================================================

	public async getInitializeRewardTransaction(
		inputs: {
			rewardAmount: Balance;
			emissionScheduleMs: Timestamp;
			emissionRate: bigint;
			emissionDelayTimestampMs: Timestamp;
			rewardCoinType: CoinType;
			walletAddress: SuiAddress;
		} & FarmOwnerOrOneTimeAdminCap
	) {
		return this.fetchApiTransaction<ApiFarmsInitializeStakingPoolRewardBody>(
			"transactions/initialize-reward",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}

	public async getTopUpRewardsTransaction(
		inputs: {
			rewards: {
				rewardAmount: Balance;
				rewardCoinType: CoinType;
			}[];
			walletAddress: SuiAddress;
		} & FarmOwnerOrOneTimeAdminCap
	) {
		return this.fetchApiTransaction<ApiFarmsTopUpStakingPoolRewardsBody>(
			"transactions/top-up-reward",
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
		this.stakingPool.rewardCoins[
			rewardCoinIndex
		].rewardsAccumulatedPerShare += newRewardsAccumulatedPerShare;
	}

	private rewardsRemaining(inputs: { rewardCoinIndex: number }): Balance {
		const rewardCoin = this.stakingPool.rewardCoins[inputs.rewardCoinIndex];

		const currentTimestamp = dayjs().valueOf();

		const numberOfEmissions = BigInt(
			Math.floor(
				(currentTimestamp - rewardCoin.emissionStartTimestamp) /
					rewardCoin.emissionSchedulesMs
			)
		);
		const emittedRewards = rewardCoin.emissionRate * numberOfEmissions;

		const totalRewards = rewardCoin.rewards;
		if (totalRewards <= emittedRewards) return BigInt(0);

		return totalRewards - emittedRewards;
	}

	private calcRewardsToEmit(inputs: {
		rewardCoin: FarmsStakingPoolRewardCoin;
	}): Balance {
		const { rewardCoin } = inputs;

		const currentTimestamp = dayjs().valueOf();

		// ia. Calculate the number of rewards that have been emitted since the beginning of the reward's emissions schedule.
		const totalRewardsEmitted = this.calcRewardsEmittedFromTimeTmToTn({
			timestampTm: rewardCoin.emissionStartTimestamp,
			timestampTn: rewardCoin.lastRewardTimestamp,
			rewardCoin,
		});

		// ib. Calculate the number of rewards that have yet to be emitted.
		const totalRewards = rewardCoin.rewards;
		const rewardsRemaining =
			totalRewardsEmitted < totalRewards
				? totalRewards - totalRewardsEmitted
				: BigInt(0);

		// ii. Calculate the number of rewards that have been emitted since the last time this reward was emitted.
		const rewardsToEmit = this.calcRewardsEmittedFromTimeTmToTn({
			timestampTm: rewardCoin.lastRewardTimestamp,
			timestampTn: currentTimestamp,
			rewardCoin,
		});

		// IMPORTANT: Cap the amount of rewards to emit by the amount of remaining rewards.
		//
		return rewardsRemaining < rewardsToEmit
			? rewardsRemaining
			: rewardsToEmit;
	}

	private calcRewardsEmittedFromTimeTmToTn(inputs: {
		timestampTm: Timestamp;
		timestampTn: Timestamp;
		rewardCoin: FarmsStakingPoolRewardCoin;
	}): Balance {
		const { timestampTm, timestampTn, rewardCoin } = inputs;

		const numberOfEmissionsFromTimeTmToTn =
			(timestampTn - timestampTm) /
			// -----------------------------------------------
			rewardCoin.emissionSchedulesMs;

		return (
			BigInt(Math.floor(numberOfEmissionsFromTimeTmToTn)) *
			rewardCoin.emissionRate
		);
	}
}
