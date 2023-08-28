import {
	Apy,
	Balance,
	CoinType,
	CoinsToDecimals,
	CoinsToPrice,
	SuiNetwork,
	Timestamp,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsIncreaseStakingPoolRewardsEmissionsBody,
	ApiFarmsInitializeStakingPoolRewardBody,
	ApiFarmsStakeBody,
	ApiFarmsTopUpStakingPoolRewardsBody,
	ApiHarvestFarmsRewardsBody,
	FarmsMultiplier,
	FarmsStakingPoolObject,
} from "./farmsTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Casting, Helpers } from "../../general/utils";
import { Coin } from "..";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

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

			// ii. Calculate how many rewards have to be emitted.
			const numberOfEmissions =
				(currentTimestamp - rewardCoin.lastRewardTimestamp) /
				rewardCoin.emissionSchedulesMs;

			const rewardsToEmit =
				rewardCoin.emissionRate * BigInt(Math.floor(numberOfEmissions));

			// iii. Increase the amount of rewards emitted per share.
			this.increaseRewardsAccumulatedPerShare({
				rewardsToEmit,
				rewardCoinIndex,
			});

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

		this.emitRewards();

		const rewardCoin = this.rewardCoin({ coinType });
		const currentTimestamp = dayjs().valueOf();

		if (rewardCoin.emissionStartTimestamp > currentTimestamp) return 0;

		const emissionRateUsd =
			Coin.balanceWithDecimals(rewardCoin.emissionRate, decimals) * price;

		dayjs.extend(duration);
		const oneYearMs = dayjs.duration(1, "year").asMilliseconds();
		const rewardsUsdOneYear =
			emissionRateUsd * (oneYearMs / rewardCoin.emissionSchedulesMs);

		return rewardsUsdOneYear / tvlUsd;
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
			((lockDurationMs - this.stakingPool.minLockDurationMs) /
				(totalPossibleLockDurationMs <= 0
					? 1
					: totalPossibleLockDurationMs)) *
			Casting.bigIntToFixedNumber(this.stakingPool.maxLockMultiplier);

		return Casting.numberToFixedBigInt(newMultiplier);
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
		const rewardsAccumulatedPerShare =
			this.stakingPool.rewardCoins[rewardCoinIndex]
				.rewardsAccumulatedPerShare;

		this.stakingPool.rewardCoins[
			rewardCoinIndex
		].rewardsAccumulatedPerShare =
			rewardsAccumulatedPerShare + newRewardsAccumulatedPerShare;
	}
}
