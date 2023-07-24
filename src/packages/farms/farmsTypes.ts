import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	Balance,
	Event,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";
import { CoinType } from "../coin/coinTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type FarmsMultiplier = bigint;

// =========================================================================
//  Objects
// =========================================================================

// =========================================================================
//  Staking Pool
// =========================================================================

export type FarmsLockEnforcement = "Strict" | "Relaxed";

export interface FarmsStakingPoolRewardCoin {
	coinType: CoinType;
	rewards: Balance;
	rewardsAccumulatedPerShare: Balance;
	emissionRate: Balance;
	emissionSchedulesMs: Timestamp;
	emissionStartTimestamp: Timestamp;
	emissionEndTimestamp: Timestamp;
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
	minStakeAmount: Balance;
	lockEnforcement: FarmsLockEnforcement;
}

export interface StakingPoolOwnerCapObject extends Object {
	stakingPoolId: ObjectId;
}

// =========================================================================
//  Staked Position
// =========================================================================

export interface FarmsStakedPositionRewardCoin {
	coinType: CoinType;
	baseRewardsAccumulated: Balance;
	baseRewardsDebt: Balance;
	multiplierRewardsAccumulated: Balance;
	multiplierRewardsDebt: Balance;
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
	lastHarvestRewardsTimestamp: Timestamp;
}

// =========================================================================
//  Events
// =========================================================================

export interface FarmsAddedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: Balance;
}

export interface FarmsCreatedVaultEvent extends Event {
	vaultId: ObjectId;
	stakeType: CoinType;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	maxLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
}

export interface FarmsDepositedPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	amount: Balance;
}

export interface FarmsDestroyedStakedPositionEvent extends Event {
	stakedPositionId: ObjectId;
}

export interface FarmsHarvestedRewardsEvent extends Event {
	afterburnerVaultId: ObjectId;
	rewardTypes: CoinType[];
	rewardAmounts: Balance[];
}

export interface FarmsIncreasedEmissionsEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	emissionScheduleMs: Timestamp;
	emissionRate: bigint; // Balance ?
}

export interface FarmsInitializedRewardEvent extends Event {
	vaultId: ObjectId;
	rewardType: CoinType;
	rewardAmount: Balance;
	emissionRate: Balance;
	emissionStartMs: Timestamp;
}

export interface FarmsJoinedEvent extends Event {
	stakedPositionId: ObjectId;
	otherStakedPositionId: ObjectId;
}

export interface FarmsLockedEvent extends Event {
	stakedPositionId: ObjectId;
	lockStartTimestampMs: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
}

export interface FarmsSplitEvent extends Event {
	stakedPositionId: ObjectId;
	splitStakedPositionId: ObjectId;
}

export interface FarmsStakedEvent extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	multipliedStakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockDurationMs: Timestamp;
	lockMultiplier: FarmsMultiplier;
}

export interface FarmsStakedEventRelaxed extends Event {
	stakedPositionId: ObjectId;
	vaultId: ObjectId;
	stakedType: CoinType;
	stakedAmount: Balance;
	lockStartTimestampMs: Timestamp;
	lockEndTimestampMs: Timestamp;
}

export interface FarmsUnlockedEvent extends Event {
	stakedPositionId: ObjectId;
}

export interface FarmsWithdrewPrincipalEvent extends Event {
	stakedPositionId: ObjectId;
	amount: Balance;
}

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Staked Positions API
// =========================================================================

export interface ApiFarmsOwnedStakedPositionsBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking API
// =========================================================================

export interface ApiFarmsStakeBody {
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	stakeAmount: Balance;
	walletAddress: SuiAddress;
}

export interface ApiFarmsDepositPrincipalBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	depositAmount: Balance;
	walletAddress: SuiAddress;
}

export interface ApiFarmsUnstakeBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewardCoinTypes: CoinType[];
	withdrawAmount: Balance;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Locking API
// =========================================================================

export interface ApiFarmsLockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	lockDurationMs: Timestamp;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsRenewLockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsUnlockBody {
	stakedPositionId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Harvest Rewards API
// =========================================================================

export interface ApiHarvestFarmsRewardsBody {
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	stakedPositionIds: ObjectId[];
	rewardCoinTypes: CoinType[];
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking Pool API
// =========================================================================

// =========================================================================
//  Staking Pool Creation API
// =========================================================================

export interface ApiFarmsCreateStakingPoolBody {
	lockEnforcement: FarmsLockEnforcement;
	minLockDurationMs: Timestamp;
	maxLockDurationMs: Timestamp;
	minLockMultiplier: FarmsMultiplier;
	minStakeAmount: Balance;
	stakeCoinType: CoinType;
	walletAddress: SuiAddress;
}

// =========================================================================
//  Staking Pool Mutation API
// =========================================================================

export interface ApiFarmsInitializeStakingPoolRewardBody {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	rewardAmount: Balance;
	emissionScheduleMs: Timestamp;
	emissionRate: bigint;
	emissionDelayTimestampMs: Timestamp;
	stakeCoinType: CoinType;
	rewardCoinType: CoinType;
	walletAddress: SuiAddress;
}

export interface ApiFarmsTopUpStakingPoolRewardsBody {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewards: {
		rewardCoinType: CoinType;
		rewardAmount: Balance;
	}[];
	walletAddress: SuiAddress;
}

export interface ApiFarmsIncreaseStakingPoolRewardsEmissionsBody {
	ownerCapId: ObjectId;
	stakingPoolId: ObjectId;
	stakeCoinType: CoinType;
	rewards: {
		rewardCoinType: CoinType;
		emissionScheduleMs: Timestamp;
		emissionRate: bigint;
	}[];
	walletAddress: SuiAddress;
}

export interface ApiFarmsOwnedStakingPoolOwnerCapsBody {
	walletAddress: SuiAddress;
}
