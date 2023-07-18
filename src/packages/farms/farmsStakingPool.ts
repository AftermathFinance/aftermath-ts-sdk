import { Balance, CoinType, SuiNetwork, Timestamp, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiFarmsIncreaseStakingPoolEmissionsBody,
	ApiFarmsInitializeStakingPoolRewardBody,
	ApiFarmsStakeBody,
	ApiFarmsTopUpStakingPoolRewardBody,
	ApiHarvestFarmsRewardsBody,
	FarmsStakingPoolObject,
} from "./farmsTypes";
import { ObjectId, SuiAddress } from "@mysten/sui.js";

export class FarmsStakingPool extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly stakingPool: FarmsStakingPoolObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `farms/${stakingPool.objectId}`);
		this.stakingPool = stakingPool;
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

	public async getTopUpRewardTransaction(inputs: {
		ownerCapId: ObjectId;
		rewardAmount: Balance;
		rewardCoinType: CoinType;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsTopUpStakingPoolRewardBody>(
			"transactions/top-up-reward",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}

	public async getIncreaseEmissionsTransaction(inputs: {
		ownerCapId: ObjectId;
		emissionScheduleMs: Timestamp;
		emissionRate: bigint;
		rewardCoinType: CoinType;
		walletAddress: SuiAddress;
	}) {
		return this.fetchApiTransaction<ApiFarmsIncreaseStakingPoolEmissionsBody>(
			"transactions/top-up-reward",
			{
				...inputs,
				stakeCoinType: this.stakingPool.stakeCoinType,
				stakingPoolId: this.stakingPool.objectId,
			}
		);
	}
}
