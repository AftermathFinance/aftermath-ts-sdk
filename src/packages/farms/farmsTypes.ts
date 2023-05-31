import { ObjectId } from "@mysten/sui.js";
import { Balance, Object, Timestamp } from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type FarmsMultiplier = bigint;

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////
//// Staking Pool
/////////////////////////////////////////////////////////////////////

export interface FarmsStakingPoolRewardCoin {
	coinType: CoinType;
	rewards: Balance;
	rewardsAccumulatedPerShare: Balance;
	emissionRateMs: Timestamp;
	emissionStartTimestamp: Timestamp;
	lastRewardTimestamp: Timestamp;
}

export interface FarmsStakingPoolObject extends Object {
	stakeCoinType: CoinType;
	stakedAmount: Balance;
	stakedAmountWithMultiplier: Balance;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	rewardCoins: FarmsStakingPoolRewardCoin[];
}

/////////////////////////////////////////////////////////////////////
//// Staked Position
/////////////////////////////////////////////////////////////////////

export interface FarmsStakedPositionRewardCoin {
	coinType: CoinType;
	rewardsAccumulated: Balance;
	rewardsDebt: Balance;
}

export interface FarmsStakedPositionObject extends Object {
	stakingPoolObjectId: ObjectId;
	stakeCoinType: CoinType;
	stakedAmount: Balance;
	stakedAmountWithMultiplier: Balance;
	lockStartTimestamp: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
	rewardCoins: FarmsStakedPositionRewardCoin[];
}
